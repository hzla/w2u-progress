(async function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const policy = document.getElementById('credit-policy');
  try {
    const response = await fetch('data/animation-credits.json?v=20261011-integration-assets',{cache:'no-cache'});
    if (!response.ok) throw new Error(`Credits returned ${response.status}.`);
    const data = await response.json();
    policy.textContent = data.policy;
    document.getElementById('move-credits').innerHTML = data.moves.map(move =>
      `<tr><td>${escape(move.name)} <small>#${move.id}</small></td><td>${escape(move.credits)}</td></tr>`).join('');
    document.getElementById('pokemon-credits').innerHTML = data.pokemon.map(pokemon => {
      const sides = pokemon.spriteSources.length ? pokemon.spriteSources.map(source =>
        `<div>${escape(source.side)}: ${escape(source.credits)}</div>`).join('') : escape(pokemon.credits);
      return `<tr><td>${escape(pokemon.name)}</td><td>${sides}</td></tr>`;
    }).join('');
  } catch (error) { policy.textContent = error.message ?? String(error); }
}());
