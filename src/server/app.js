require("dotenv").config();
const fs = require('fs');
const { auth } = require('express-openid-connect');
// const { ApolloServer as ApolloServerLambda } = require('apollo-server-lambda');
const { applyMiddleware } = require('graphql-middleware');
const { makeExecutableSchema } = require('graphql-tools') ;
const { ApolloServer, gql, AuthenticationError } = require('apollo-server');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
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
process.env.ENV = 'local'
console.log('process.env.ENV ',process.env.ENV)
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

let typeDefs;
if(process.env.ENV !== 'local') {
    typeDefs = require('./graphql/schema');
} else {
    typeDefs = require('./graphql/schema');
}

if (process.env.ENV === 'local') {
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

} else {
  // const server = new ApolloServerLambda({
  //   typeDefs,
  //   resolvers: resolvers,
  //   context: async ({event, context }) => ({
  //     user: await getUser(event.headers.authorization),
  //     context,
  //     event
  //   }),
  // });
  //
  // exports.graphqlHandler = server.createHandler({
  //   cors: {
  //     origin: '*',
  //     credentials: true
  //   }
  // });
}
