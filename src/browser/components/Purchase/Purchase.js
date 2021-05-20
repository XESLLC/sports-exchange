import React, { useEffect, useState } from "react";

import client from '../../lib/client';
import { get } from 'lodash';

const Purchase = ({ auth }) => {
  const [quantity, setQuantity] = useState(0);
  const [team, setTeam] = useState(null);
  const [tournament, setTournament] = useState("default");

  const [teams, setTeams] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await client.getLeagues();
      const teams = get(res, 'data.leagues[0].teams', []);
      setTeams(teams);
    }
    fetchData();
  }, []); // Or [] if effect doesn't need props or state

  const purchase = () => {

    const data = {
      team,
      quantity,
      tournament
    };
    
    client.ipoPurchase(data)
  }


  return (
    <div>
      Purchase

      <br /><br />

      <select onChange={(e) => setTeam(e.target.value)}>
      {teams && teams.map((team, teamIndy) => (
        <option key={teamIndy} value={team.id}>{team.name}</option>
      ))}
      </select>

      <br/><br/>

      shares: <input type="text" onChange={(e) => setQuantity(e.target.value)}></input>


      <br/><br/>

      <button onClick={() => purchase()}>Purchase</button>

    </div>
  );
};

export default Purchase;
