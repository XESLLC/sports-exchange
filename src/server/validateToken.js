require("dotenv").config();

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const { AUTH0_API_IDENTIFIER, AUTH0_DOMAIN } = process.env;

const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
});

const getKey = (header, cb) => {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    cb(null, signingKey);
  });
}

async function isTokenValid(token) {
  if (token) {
    const bearerToken = token.split(" ");

    const result = new Promise((resolve, reject) => {
      jwt.verify(
        bearerToken[1],
        getKey,
        {
          audience: AUTH0_API_IDENTIFIER,
          issuer: `https://${AUTH0_DOMAIN}/`,
          algorithms: ["RS256"]
        },
        (error, decoded) => {
          if (error) {
            reject({ error });
          } else if (decoded) {
            resolve({ decoded });
          }
        }
      );
    });

    return result;
  }

  return { error: "No token provided" };
}

module.exports = isTokenValid;