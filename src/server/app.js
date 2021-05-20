require("dotenv").config();

const { auth } = require('express-openid-connect');

const { ApolloServer, gql, AuthenticationError } = require('apollo-server');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');

const { initModels } = require('./models');

const { AUTH0_CLIENT_ID, AUTH0_DOMAIN } = process.env;

const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
});

const getKey = (header, cb) => {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    cb(null, signingKey);
  });
}

const options = {
  audience: AUTH0_CLIENT_ID,
  issuer: `https://${AUTH0_DOMAIN}/`,
  algorithms: ['RS256']
};

const getUser = async token => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, options, (err, decoded) => {
      if(err) {
        return reject(err);
      }
      console.log('decoded: ', decoded);
      resolve(decoded);
    });
  });
};

// The ApolloServer constructor requires two parameters: your schema
// definition and your set of resolvers.
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => ({
    user: await getUser(req.headers.authorization)
  })
});

console.log("Using Auth0 client domain: ", AUTH0_DOMAIN);

initModels().then(() => {
  // The `listen` method launches a web server.
  server.listen().then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  });
});
