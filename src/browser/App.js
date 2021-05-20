import React from 'react';
import { Redirect, Route, Switch, withRouter } from 'react-router-dom';

import Header from './components/Header/Header';
import Holdings from './components/Holdings/Holdings';
import Home from './components/Home/Home';
import Leagues from './components/Leagues/Leagues';
import Profile from './components/Profile/Profile';
import Purchase from './components/Purchase/Purchase';
import Callback from './components/Callback/Callback';
import Auth from './lib/Auth';

function App({ history }) {
  const auth = new Auth(history);
  return (
    <div className="App">
      <Header auth={auth}/>
      <Switch>
        <div className="body">
          <Route exact path="/" render={props => <Home auth={auth} {...props} />} />
          <Route exact path="/callback" render={props => <Callback auth={auth} {...props} />} />
          <Route exact path="/profile" render={props => <Profile auth={auth} {...props} />} />
          <Route exact path="/leagues" render={props => <Leagues auth={auth} {...props} />} />
          <Route exact path="/purchase" render={props => <Purchase auth={auth} {...props} />} />
          <Route exact path="/holdings" render={props => <Holdings auth={auth} {...props} />} />
        </div>
      </Switch>
    </div>
  );
}

export default withRouter(App);
