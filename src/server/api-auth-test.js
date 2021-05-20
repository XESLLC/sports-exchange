var request = require("request");

var options = { method: 'GET',
  url: 'http://localhost:4000/graphql',
  headers: { authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijcxc05zUERjdkREbWtRMksta1I0eSJ9.eyJpc3MiOiJodHRwczovL2FlLWRldi51cy5hdXRoMC5jb20vIiwic3ViIjoicWdJZFFUenJrcHV2dHNma1B4b2RiQ0RralQzOUJ6SVBAY2xpZW50cyIsImF1ZCI6ImxvY2FsaG9zdDo0MDAwL2dyYXBocWwiLCJpYXQiOjE2MTUwNzE3NjcsImV4cCI6MTYxNTE1ODE2NywiYXpwIjoicWdJZFFUenJrcHV2dHNma1B4b2RiQ0RralQzOUJ6SVAiLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMifQ.lLzqF2hoja5tZo6EbL_gX32kl7fcbLOXWiBJM43elj-sJiobeahAOAxE-okYFWAxzrGDLYe-jyDT7cgiZmBb0e9FEzeq5Tvi396c2yyZwfnbdnZlDbSA8gA-XR412gHrHON_ii7sknF8cwbokEdGGQvUbMplen68bwdFnq27uRBc4-TZgk5FVwuPVEYKafzNq0v9QSe5qCNPxY7qhj6W3Mn2_eRYYMDymLDlhp7ZSxiriEfWK4nXMf1ql6lLQ5qGz7aBHLsT-s7mHRkDYIS3bGA6hcsJ3e7HujfoXMfzqAiM33WZSPA5RaKNVMuqYUCNBpfjANO60ExiW8eoaYCn9Q' } };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});