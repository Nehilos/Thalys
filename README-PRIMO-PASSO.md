# Thalys v0.35

## v0.35 - Conflict Resolver

- Aggiunto `js/conflict-resolver.js`.
- Le operazioni granulari pendenti vengono applicate allo stato Drive piu recente prima del merge tradizionale.
- Acqua: i delta locali offline vengono sommati al valore remoto corrente, evitando la sovrascrittura di incrementi concorrenti.
- Collezioni (nutrizione, misure, schede, storico workout, meditazione): add/update/delete vengono risolti per record.
- Impostazioni, profilo e target: una modifica locale pendente viene conservata durante il consolidamento.
- Il merge storico resta attivo come fallback per ogni dato non ancora coperto dal resolver.
- Sync protocol: v3.
- Cache PWA/offline aggiornata a v0.35.
