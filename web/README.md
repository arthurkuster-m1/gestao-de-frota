# Frota — app web (React + TypeScript + Supabase)

Substitui o protótipo Python (`../frota`), que fica só como referência de regras. Plano: `../docs/plano-app.md`.

```bash
cd web
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_ANON_KEY (chave anon/publishable; NUNCA a service_role)
npm run dev                  # http://localhost:5173
npm run typecheck && npm test && npm run build
```

## Publicar no Cloudflare Pages
Conectar o repositório e usar: **Root directory** `web`; **Build command** `npm run build`; **Output directory** `dist`.
Variáveis (Production e Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION=22`.
Depois do primeiro deploy, ponha a URL `https://….pages.dev` em *Supabase › Authentication › URL Configuration › Site URL*.

## De onde veio
`src/ds` (design system), `Shell`/`Sidebar`, `auth` e `supabase.ts` foram copiados do `familia-kuster` e adaptados:
Azul Frota `#3366A0`, Montserrat no lugar das fontes de lá, "espaço de trabalho" no lugar de "família".
`src/ds/styles/components.css` ainda traz estilos de telas do `familia-kuster` (Finanças, Bebê, Treinos) que a Frota não usa; podar quando as telas da Frota estiverem prontas.
