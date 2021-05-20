const { auth } = require('express-openid-connect');

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: 'wFGJdbEppuoCzEZQWtXhUYsUysShH7gQLGUtKjDbeoEUvoZZyneoLTzzqC45LUM8',
  baseURL: 'http://localhost:3000',
  clientID: 'bWBD0eGU2Wwti8bZP5krthcW5MtgQGni',
  issuerBaseURL: 'https://ae-dev.us.auth0.com'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

// req.isAuthenticated is provided from the auth router
app.get('/', (req, res) => {
  console.log("isAuth: ", req.oidc.isAuthenticated());
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});
