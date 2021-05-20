import React from 'react'
import { Redirect } from 'react-router-dom'

class ProtectedRoute extends React.Component {
  render() {
    const { Component, authUser } = this.props;
    const isAuthenticated = authUser !== null;

    if (isAuthenticated) {
      return (
        <Component />
      )
    }

    return (
      <Redirect to={{ pathname: '/login' }} />
    );
  }
}

export default ProtectedRoute;
