import auth0 from 'auth0-js';

const domain = "ae-dev.us.auth0.com";
const clientID = "bWBD0eGU2Wwti8bZP5krthcW5MtgQGni";

const ACCESS_TOKEN = "access_token";
const ID_TOKEN = "id_token";
const EXPIRES_AT = "expires_at";

export default class Auth {
  constructor(history) {
    if (!Auth.instance) {
      this.history = history;
      this.auth0 = new auth0.WebAuth({
        domain,
        clientID,
        redirectUri: 'http://localhost:8080/callback',
        responseType: "token id_token",
        scope: "openid profile email"
      });

      Auth.instance = this;
    }

    return Auth.instance;
  }

  getInstance() {
    return this;
  };

  login = () => {
    this.auth0.authorize();
  };

  handleAuth = () => {
    this.auth0.parseHash((err, authResult) => {
      if(authResult && authResult.accessToken && authResult.idToken) {
        this.setSession(authResult);
        this.history.push("/");
      } else if (err) {
        console.log(err);
      }
    })
  };

  setSession = authResult => {
    // Calculates the time the access token will expire.
    const expiresAt = JSON.stringify(
      authResult.expiresIn * 1000 + new Date().getTime()
    );

    localStorage.setItem(ACCESS_TOKEN, authResult.accessToken);
    localStorage.setItem(ID_TOKEN, authResult.idToken);
    localStorage.setItem(EXPIRES_AT, expiresAt);
  };

  isAuthenticated = () => {
    // Check whether the current time is past the
    // access token's expiry time
    const expiresAt = JSON.parse(localStorage.getItem(EXPIRES_AT));
    return new Date().getTime() < expiresAt;
  };

  logout = () => {
    localStorage.removeItem(ACCESS_TOKEN);
    localStorage.removeItem(ID_TOKEN);
    localStorage.removeItem(EXPIRES_AT);
    this.userProfile = null;

    this.auth0.logout({
      clientID,
      returnTo: "http://localhost:8080"
    });
  };

  getIdToken = () => {
    const idToken = localStorage.getItem(ID_TOKEN);
    if (!idToken) {
      throw new Error("No ID token found")
    }
    return idToken;
  };

  getAccessToken = () => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN);
    if (!accessToken) {
      throw new Error("No access token found")
    }
    return accessToken;
  };

  getProfile = callback => {
    this.auth0.client.userInfo(this.getAccessToken(), (err, profile) => {
      callback(profile);
    });
  };
}
