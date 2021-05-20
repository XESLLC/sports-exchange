import React from 'react';
import { Link } from 'react-router-dom' 

const LinkIfAuth = ({auth, to, children}) => {
  if (auth.isAuthenticated()) {
    return (
      <Link to={to}>{children}</Link>
    )
  }
  return null;
};

const Header = ({auth}) => {
  return (
    <nav>
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><LinkIfAuth auth={auth} to="/leagues">Leagues</LinkIfAuth></li>
        <li><LinkIfAuth auth={auth} to="/holdings">Holdings</LinkIfAuth></li>
        <li><LinkIfAuth auth={auth} to="/purchase">Purchase</LinkIfAuth></li>
        <li><LinkIfAuth auth={auth} to="/profile">Profile</LinkIfAuth></li>
        <li>
          <button onClick={auth.isAuthenticated() ? auth.logout : auth.login}> 
            {auth.isAuthenticated() ? "log out" : "log in"}
          </button>
        </li>
      </ul>
    </nav>
  )
}

export default Header;
