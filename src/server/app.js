require("dotenv").config();
const fs = require('fs');
const { auth } = require('express-openid-connect');
const { applyMiddleware } = require('graphql-middleware');
const { makeExecutableSchema } = require('graphql-tools') ;
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const resolvers = require('./graphql/resolvers');
const { initModels } = require('./models');

const { ApolloServerPluginLandingPageGraphQLPlayground } = require('apollo-server-core')

//Env
console.log('process.env.ENV ',process.env.ENV)
isNotLocal = (process.env.ENV !== 'local')
const { ApolloServer, gql, AuthenticationError } = isNotLocal? require('apollo-server-lambda') : require('apollo-server');

const AUTH0_CLIENT_ID = !!process.env.AUTH0_CLIENT_ID? process.env.AUTH0_CLIENT_ID : 'undvcjb2Ky8Kt4byZegdWY4V5OoYhEWA'
const AUTH0_DOMAIN = !!process.env.AUTH0_DOMAIN? process.env.AUTH0_DOMAIN : 'dev-8duzx03a.us.auth0.com'
console.log('AUTH0_CLIENT_ID -', AUTH0_CLIENT_ID, "AUTH0_DOMAIN -", AUTH0_DOMAIN)
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

// Stub user for local development — bypasses Auth0 token validation so the
// GraphQL playground and local frontend work without a real JWT.
const LOCAL_DEV_USER = {
  sub: 'local|dev',
  name: 'Local Dev',
  email: 'exigentemail@gmail.com',
  'https://sports-exchange/roles': ['ADMIN'],
  'https://sports-exchange/firstname': 'Local',
  'https://sports-exchange/lastname': 'Dev'
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

  const graphqlHandler = server.createHandler({
    cors: {
      origin: '*',
      methods: '*',
      allowedHeaders: '*'
    }
  });

  module.exports.graphqlHandler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    return await graphqlHandler(event, context)
  };

} else {
  console.log("local setup")
  // local setup — auth is stubbed with LOCAL_DEV_USER, no JWT needed
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => ({
      user: LOCAL_DEV_USER
    }),
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()]
  });

  initModels().then(() => {
    // The `listen` method launches a web server.
    server.listen().then(({ url }) => {
      console.log("Using Auth0 client domain: ", AUTH0_DOMAIN); // for paid account only
      console.log(`🚀  Server ready at ${url}`);
    });
  });
}
