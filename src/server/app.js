require("dotenv").config();
const fs = require('fs');
const { auth } = require('express-openid-connect');
const { applyMiddleware } = require('graphql-middleware');
const { makeExecutableSchema } = require('graphql-tools') ;
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const resolvers = require('./graphql/resolvers');
const { initModels } = require('./models');

//Env
console.log('process.env.ENV ',process.env.ENV)
isNotLocal = (process.env.ENV !== 'local')
const { ApolloServer, gql, AuthenticationError } = isNotLocal? require('apollo-server-lambda') : require('apollo-server');

const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID? process.env.AUTH0_CLIENT_ID : 'undvcjb2Ky8Kt4byZegdWY4V5OoYhEWA'
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN? process.env.AUTH0_DOMAIN : 'dev-8duzx03a.us.auth0.com'

//Auth Obj on server
const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
});

const getKey = (header, cb) => {
  console.log("header . kid", header);
  client.getSigningKey(header.kid, (err, key) => {
    console.log("key" , key)
    const signingKey = key.publicKey || key.rsaPublicKey;
    cb(null, signingKey);
  });
}

const options = {
  audience: 'undvcjb2Ky8Kt4byZegdWY4V5OoYhEWA',
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
if(isNotLocal) {
  typeDefs = require('./graphql/schema');
} else {
  typeDefs = require('./graphql/schema'); // this may change with TS
}

if (isNotLocal) {
  //aws setup
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: async ({event, context }) => ({
          user: await getUser(event.headers.Authorization),
          context,
          event
      })
    });

    const graphqlHandler = server.createHandler();

    module.exports.graphqlHandler = (event, context, callback) => {
      context.callbackWaitsForEmptyEventLoop = false;
      function callbackFilter(error, output) {
        output.headers['Access-Control-Allow-Origin'] = '*';
        callback(error, output);
      }

      graphqlHandler(event, context, callbackFilter);

    };
} else {
  // local setup
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => ({
      user: await getUser(req.headers.Authorization)
    })
  });

  console.log("Using Auth0 client domain: ", AUTH0_DOMAIN); // for paid account only

  initModels().then(() => {
    // The `listen` method launches a web server.
    server.listen().then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  });
}
