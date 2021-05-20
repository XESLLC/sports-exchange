import React, { useEffect, useState } from "react";

import client from '../../lib/client';

const Leagues = ({ auth }) => {
  const [leagues, setLeagues] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await client.getLeagues();

      console.log('res: ', res);

      setLeagues(res.data.leagues)
    }
    fetchData();
  }, []); // Or [] if effect doesn't need props or state

  return (
    <div>
      Leagues

      {leagues && leagues.map(league => {
        return (
          <div>
            <div>{league.name}</div>
            <div>
              {league.teams && league.teams.map(team => (
                <div style={{ fontSize: "12px"}}>{team.name}</div>
              ))}
            </div>
          </div>
        )
      })}

    </div>
  );
};

export default Leagues;
