import { ApolloClient, gql, createHttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import Auth from './Auth';


class Client {

  constructor() {
    if (!Client.instance) {
      const httpLink = createHttpLink({
        uri: 'http://localhost:4000/graphql',
      });

      const authLink = setContext((_, { headers }) => {
        const idToken = new Auth().getIdToken();

        // return the headers to the context so httpLink can read them
        return {
          headers: {
            ...headers,
            authorization: idToken ? idToken : ""
          }
        }
      });

      this.apolloClient = new ApolloClient({
        link: authLink.concat(httpLink),
        cache: new InMemoryCache()
      });

      Client.instance = this;
    }

    return Client.instance;
  }

  async getLeagues() {
    return new Promise((resolve, reject) => {

      const query = gql`
      {
        leagues {
          id
          name
          teams {
            id
            name
          }
        }
      }`;

      this.apolloClient
        .query({
          query
        })
        .then(result => resolve(result));
     })
  };


  async ipoPurchase(data) {
    console.log('purchase data: ', data);
    // return new Promise((resolve, reject) => {

    //   const query = gql`
    //   {
    //     leagues {
    //       id
    //       name
    //       teams {
    //         id
    //         name
    //       }
    //     }
    //   }`;

    //   this.apolloClient
    //     .mutate({
    //       query
    //     })
    //     .then(result => resolve(result));
    //  })
  };


}

const instance = new Client();
Object.freeze(instance);

export default instance;
