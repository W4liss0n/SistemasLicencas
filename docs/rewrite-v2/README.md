# Rewrite v2 - Operacao

Documentos operacionais do runtime `v2` do sistema de licencas.

## Conteudo

- [Roadmap consolidado (feito x faltante)](./roadmap-v2.md)
- [Progresso v2 e proximos passos](./progresso-v2-e-proximos-passos.md)
- [Mini-spec Subscription MVP interno](./mini-spec-subscription-mvp-interno.md)
- [Mini-spec Catalog Billing MVP interno](./mini-spec-catalog-billing-mvp-interno.md)
- [Mini-spec Interface Web Interna (fase 11)](./mini-spec-fase11-interface-web-interna.md)
- [Mini-spec Hardening Interface Web Interna (fase 12)](./mini-spec-fase12-hardening-interface-web-interna.md)
- [Evidencia fase 13 (auth offline)](./evidencias/fase13-auth-offline-2026-03-05.md)
- [Evidencia fase 14A (browser login OIDC)](./evidencias/fase14a-browser-login-oidc-2026-03-05.md)
- [Matriz de compatibilidade v1 vs v2](./compatibility-matrix.md)
- [Matriz gerada pelo runner local](./compatibility-matrix.generated.md)

## Atualizacao da matriz gerada

Execute no diretorio raiz do workspace:

```bash
npm run test:legacy:local
```

Saida gerada em:

- `docs/rewrite-v2/compatibility-matrix.generated.md`
