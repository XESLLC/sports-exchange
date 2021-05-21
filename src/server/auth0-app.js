const { auth } = require('express-openid-connect');
// TODO: configure
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: 'wgtd1HpimHl-V_xi8fISNBYdyus-sTQ3xUkDdOlMbzyrymGC5eD9VUzGcBQM8W8z',
  baseURL: 'http://serverless-react-sports-serverlessdeploymentbuck-kj23yr3zm351.s3-website-us-west-2.amazonaws.com/',
  clientID: '60a6da21a4588f003f7cbad6',
  issuerBaseURL: 'https://dev-8duzx03a.us.auth0.com/api/v2/'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

// req.isAuthenticated is provided from the auth router
app.get('/', (req, res) => {
  console.log("isAuth: ", req.oidc.isAuthenticated());
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});
