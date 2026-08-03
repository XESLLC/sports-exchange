// Tournament.status is one of: 'active' | 'inactive' | 'closed'
//
// - active:   visible to everyone, accepts new entries, trading and
//             milestone/dividend updates all allowed.
// - inactive: hidden from non-admins (existing behavior, enforced client-side
//             in Exchanges.vue/Portfolio.vue/etc, same as before this change).
// - closed:   visible to everyone (so participants can still see history),
//             but no new entries, no trading, and no milestone/dividend
//             updates. Enforced here, server-side, so it can't be bypassed
//             by calling the GraphQL API directly.

function assertTournamentTradingOpen(tournament) {
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  if (tournament.status === 'closed') {
    throw new Error('This tournament is closed. Trading and dividend/milestone updates are no longer allowed.');
  }
}

function assertTournamentAcceptingNewEntries(tournament) {
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  if (tournament.status !== 'active') {
    throw new Error(`This tournament is not currently accepting new entries (status: ${tournament.status}).`);
  }
}

module.exports = {
  assertTournamentTradingOpen,
  assertTournamentAcceptingNewEntries
};
