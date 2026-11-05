import { PlugsConnected } from "@phosphor-icons/react";
import { Card, EmptyState, Page } from "../ds";

export function SemConfig() {
  return (
    <Page center>
      <Card>
        <EmptyState icon={<PlugsConnected size={30} />} title="Falta conectar o Supabase">
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no Cloudflare Pages (Settings → Variables) ou em
          <code> .env.local</code>, e faça um novo deploy. Passo a passo em <code>supabase/README.md e docs/plano-app.md</code>.
        </EmptyState>
      </Card>
    </Page>
  );
}
