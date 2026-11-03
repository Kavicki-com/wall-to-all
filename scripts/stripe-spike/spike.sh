#!/usr/bin/env bash
# Spike F8: valida na API de teste da Stripe os fluxos de fundos do plano
# (docs/plans/2026-11-02-f8-pagamentos-stripe-plan.md, Task 1).
#
# Uso (no SEU terminal, Git Bash):
#   export STRIPE_SECRET_KEY=sk_test_...
#   bash scripts/stripe-spike/spike.sh
#
# A chave é lida só do ambiente e passada ao curl pela entrada padrão (não
# aparece na linha de comando nem na saída). Cole no chat apenas a saída.
# Nunca rodar com `bash -x`.

set -u

: "${STRIPE_SECRET_KEY:?defina STRIPE_SECRET_KEY no terminal (export STRIPE_SECRET_KEY=sk_test_...)}"
case "$STRIPE_SECRET_KEY" in
  sk_test_*) ;;
  *) echo "Use uma secret key de TEST mode (sk_test_...)."; exit 1 ;;
esac

ACCT="${STRIPE_CONNECTED_ACCOUNT:-acct_1UXBoK3seq5yk1Fo}"
API="https://api.stripe.com"
RUN="$(date +%s)"
HDR="$(mktemp)"
trap 'rm -f "$HDR"' EXIT

RESULTS=()
record() { RESULTS+=("$1|$2|$3"); }

# stripe METHOD PATH [args do curl...]: imprime o corpo da resposta.
# Os headers da última chamada ficam em $HDR.
stripe() {
  local method="$1" path="$2"
  shift 2
  printf 'user = "%s:"\n' "$STRIPE_SECRET_KEY" |
    curl -sS -K - -X "$method" -D "$HDR" "$API$path" "$@"
}

# jget CAMPO...: lê JSON da entrada padrão e imprime cada campo (caminho com
# pontos) numa linha. Ausente = linha vazia; objeto = JSON compacto.
jget() {
  node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  let o = null;
  try { o = JSON.parse(s); } catch { o = null; }
  for (const p of process.argv.slice(1)) {
    let v = o;
    for (const k of p.split(".")) v = v == null ? undefined : v[k];
    if (v === undefined || v === null) console.log("");
    else if (typeof v === "object") console.log(JSON.stringify(v));
    else console.log(String(v));
  }
});' "$@"
}

field() { printf '%s' "$1" | jget "$2"; }

show_error() {
  local body="$1"
  local code msg
  code="$(field "$body" error.code)"
  msg="$(field "$body" error.message)"
  if [ -n "$msg" ]; then echo "    erro: ${code:-sem_codigo}: $msg"; fi
}

section() { printf '\n==== %s ====\n' "$1"; }

pause() {
  printf '%s\n' "$1"
  if [ -t 0 ]; then
    read -r -p "    (Enter para continuar) " _
  else
    echo "    (sem terminal interativo: seguindo sem esperar; reconsultar o PI depois da simulação)"
  fi
}

present() { if [ -n "$1" ]; then echo presente; else echo ausente; fi; }

# ---------------------------------------------------------------------------
section "Conta conectada $ACCT (estado atual)"
body="$(stripe GET "/v1/accounts/$ACCT")"
echo "    type=$(field "$body" type) country=$(field "$body" country)"
echo "    controller=$(field "$body" controller)"
echo "    capabilities=$(field "$body" capabilities)"
echo "    charges_enabled=$(field "$body" charges_enabled) payouts_enabled=$(field "$body" payouts_enabled)"
echo "    requirements.currently_due=$(field "$body" requirements.currently_due)"
echo "    payouts.schedule=$(field "$body" settings.payouts.schedule)"
show_error "$body"
STRIPE_VERSION="$(grep -i '^stripe-version:' "$HDR" | tr -d '\r' | cut -d' ' -f2)"

# ---------------------------------------------------------------------------
section "(a) Cartão + destination charge"
a_try() {
  stripe POST /v1/payment_intents \
    -d amount=6500 -d currency=brl \
    -d payment_method=pm_card_visa -d "automatic_payment_methods[enabled]=true" -d "automatic_payment_methods[allow_redirects]=never" \
    -d confirm=true \
    -d "transfer_data[destination]=$ACCT" -d application_fee_amount=650 \
    -d "metadata[spike]=f8-a" -d "expand[]=latest_charge" "$@"
}
body="$(a_try)"
st="$(field "$body" status)"
TR_A="$(field "$body" latest_charge.transfer)"
echo "    sem on_behalf_of: id=$(field "$body" id) status=$st transfer=$TR_A"
show_error "$body"
if [ "$st" = "succeeded" ] && [ -n "$TR_A" ]; then
  record a "PASS" "destination charge sem on_behalf_of"
else
  body="$(a_try -d "on_behalf_of=$ACCT")"
  st="$(field "$body" status)"
  TR_A="$(field "$body" latest_charge.transfer)"
  echo "    com on_behalf_of: id=$(field "$body" id) status=$st transfer=$TR_A"
  show_error "$body"
  if [ "$st" = "succeeded" ] && [ -n "$TR_A" ]; then
    record a "PASS" "destination charge so com on_behalf_of"
  else
    record a "FAIL" "destination charge falhou com e sem on_behalf_of (PORTAO: parar)"
  fi
fi

# ---------------------------------------------------------------------------
section "(b) Pix na plataforma (sem Connect)"
pix_try() {
  stripe POST /v1/payment_intents \
    -d amount=1500 -d currency=brl \
    -d "payment_method_data[type]=pix" -d "return_url=https://example.com/pix-return" \
    -d "payment_method_options[pix][expires_after_seconds]=900" \
    -d confirm=true "$@"
}
pix_print() {
  local b="$1" qr
  echo "    id=$(field "$b" id) status=$(field "$b" status) next_action.type=$(field "$b" next_action.type)"
  qr="$(field "$b" next_action.pix_display_qr_code.data)"
  echo "    qr.data: ${#qr} caracteres"
  echo "    qr.image_url_png: $(present "$(field "$b" next_action.pix_display_qr_code.image_url_png)")"
  echo "    qr.expires_at: $(field "$b" next_action.pix_display_qr_code.expires_at)"
  echo "    qr.hosted_instructions_url: $(field "$b" next_action.pix_display_qr_code.hosted_instructions_url)"
  show_error "$b"
}
PIX_BILLING=()
body="$(pix_try -d "metadata[spike]=f8-b")"
echo "  tentativa sem billing_details:"
pix_print "$body"
if [ "$(field "$body" status)" = "requires_action" ]; then
  record b "PASS" "pix sem billing_details"
else
  PIX_BILLING=(-d "payment_method_data[billing_details][name]=Cliente Teste" -d "payment_method_data[billing_details][email]=cliente.teste@example.com")
  body="$(pix_try "${PIX_BILLING[@]}" -d "metadata[spike]=f8-b")"
  echo "  tentativa com nome + e-mail:"
  pix_print "$body"
  if [ "$(field "$body" status)" = "requires_action" ]; then
    record b "PASS" "pix exige nome + e-mail"
  else
    record b "FAIL" "pix nao gerou QR (ver erro)"
  fi
fi
PI_B="$(field "$body" id)"
B_STATUS="$(field "$body" status)"

# ---------------------------------------------------------------------------
section "(b2) Simulação do Pix (aprovar)"
if [ -n "$PI_B" ] && [ "$B_STATUS" = "requires_action" ]; then
  pause "    Abra o hosted_instructions_url de (b) no navegador e simule o pagamento (aprovar)."
  b2="$(stripe GET "/v1/payment_intents/$PI_B")"
  echo "    $PI_B status final: $(field "$b2" status)"
  if [ "$(field "$b2" status)" = "succeeded" ]; then
    record b2 "PASS" "simulacao aprova"
  else
    record b2 "FAIL" "status $(field "$b2" status)"
  fi

  section "(b2') Simulação do Pix (falha ou expiração)"
  body="$(pix_try "${PIX_BILLING[@]}" -d "metadata[spike]=f8-b2-falha")"
  pix_print "$body"
  PI_B3="$(field "$body" id)"
  pause "    Abra o hosted_instructions_url acima e simule FALHA/expiração (se houver a opção)."
  b3="$(stripe GET "/v1/payment_intents/$PI_B3")"
  echo "    $PI_B3 status final: $(field "$b3" status) last_payment_error=$(field "$b3" last_payment_error.code)"
  record "b2'" "INFO" "status apos falha: $(field "$b3" status)"
else
  record b2 "SKIP" "sem PI pix de (b)"
fi

# ---------------------------------------------------------------------------
section "(c) Pix + destination charge"
body="$(pix_try "${PIX_BILLING[@]}" -d "transfer_data[destination]=$ACCT" -d application_fee_amount=150 -d "metadata[spike]=f8-c")"
pix_print "$body"
PI_C="$(field "$body" id)"
if [ "$(field "$body" status)" = "requires_action" ]; then
  pause "    Opcional: simule a aprovação do hosted_instructions_url acima para checar o transfer."
  c2="$(stripe GET "/v1/payment_intents/$PI_C?expand%5B%5D=latest_charge")"
  TR_C="$(field "$c2" latest_charge.transfer)"
  echo "    $PI_C status=$(field "$c2" status) transfer=$TR_C"
  record c "PASS" "pix aceita transfer_data (status $(field "$c2" status), transfer $(present "$TR_C"))"
else
  body="$(pix_try "${PIX_BILLING[@]}" -d "transfer_data[destination]=$ACCT" -d application_fee_amount=150 -d "on_behalf_of=$ACCT" -d "metadata[spike]=f8-c-obo")"
  echo "  tentativa com on_behalf_of:"
  pix_print "$body"
  if [ "$(field "$body" status)" = "requires_action" ]; then
    record c "PASS" "pix + destination so com on_behalf_of"
  else
    record c "FAIL" "pix nao aceita destination charge: usar fluxo platform"
  fi
fi

# ---------------------------------------------------------------------------
section "(d) Transfer da plataforma"
body="$(stripe POST /v1/payment_intents \
  -d amount=5000 -d currency=brl \
  -d payment_method=pm_card_bypassPending -d "automatic_payment_methods[enabled]=true" -d "automatic_payment_methods[allow_redirects]=never" \
  -d confirm=true -d "metadata[spike]=f8-d" -d "expand[]=latest_charge")"
CH_D="$(field "$body" latest_charge.id)"
echo "    PI $(field "$body" id) status=$(field "$body" status) charge=$CH_D"
show_error "$body"
body="$(stripe POST /v1/transfers -d amount=1000 -d currency=brl -d "destination=$ACCT" -d "metadata[spike]=f8-d1")"
echo "    transfer sem source_transaction: id=$(field "$body" id)"
show_error "$body"
if [ -n "$(field "$body" id)" ]; then record d1 "PASS" "transfer simples"; else record d1 "FAIL" "transfer simples"; fi
if [ -n "$CH_D" ]; then
  body="$(stripe POST /v1/transfers -d amount=1000 -d currency=brl -d "destination=$ACCT" -d "source_transaction=$CH_D" -d "metadata[spike]=f8-d2")"
  echo "    transfer com source_transaction: id=$(field "$body" id)"
  show_error "$body"
  if [ -n "$(field "$body" id)" ]; then record d2 "PASS" "transfer com source_transaction"; else record d2 "FAIL" "transfer com source_transaction"; fi
else
  record d2 "SKIP" "sem charge de (d)"
fi

# ---------------------------------------------------------------------------
section "(e) Reversão parcial do transfer de (a)"
if [ -n "$TR_A" ]; then
  body="$(stripe POST "/v1/transfers/$TR_A/reversals" -d amount=500 -d "metadata[spike]=f8-e")"
  echo "    reversal id=$(field "$body" id) amount=$(field "$body" amount)"
  show_error "$body"
  if [ -n "$(field "$body" id)" ]; then record e "PASS" "reversao parcial"; else record e "FAIL" "reversao parcial"; fi
else
  record e "SKIP" "sem transfer de (a)"
fi

# ---------------------------------------------------------------------------
section "(f) Payout na conta conectada (informativo)"
# No BR o plano manual de payout é proibido ("You cannot be on a manual payout
# plan in country BR"): o payout é automático e só lemos o estado. Design § 16.
body="$(stripe GET "/v1/accounts/$ACCT")"
echo "    payouts.schedule: $(field "$body" settings.payouts.schedule)"
show_error "$body"
body="$(stripe GET /v1/balance -H "Stripe-Account: $ACCT")"
echo "    saldo available=$(field "$body" available) pending=$(field "$body" pending)"
show_error "$body"
body="$(stripe GET "/v1/accounts/$ACCT/external_accounts?limit=3")"
echo "    contas externas: $(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let o;try{o=JSON.parse(s)}catch{o={}};console.log((o.data||[]).map(x=>`${x.object} ${x.bank_name||""} ****${x.last4} ${x.currency} status=${x.status}`).join("; ")||"nenhuma")})')"
show_error "$body"
record f "INFO" "payout automatico (manual proibido no BR)"

# ---------------------------------------------------------------------------
section "(g) Conta conectada nova (Accounts v2) + Account Link v1"
# Accounts v1 não cria mais contas novas: POST /v2/core/accounts em JSON.
# stripe_transfers exige também merchant.card_payments.
G_JSON='{"contact_email":"spike.'"$RUN"'@example.com","display_name":"Spike F8","identity":{"country":"br"},"dashboard":"express","defaults":{"responsibilities":{"fees_collector":"application","losses_collector":"application"}},"configuration":{"merchant":{"capabilities":{"card_payments":{"requested":true}}},"recipient":{"capabilities":{"stripe_balance":{"stripe_transfers":{"requested":true}}}}},"include":["configuration.recipient","requirements"],"metadata":{"spike":"f8-g"}}'
body="$(stripe POST /v2/core/accounts -H "Stripe-Version: 2026-10-28.preview" -H "Content-Type: application/json" -d "$G_JSON")"
NEW_ACCT="$(field "$body" id)"
echo "    id=$NEW_ACCT"
echo "    recipient.stripe_transfers=$(field "$body" configuration.recipient.capabilities.stripe_balance.stripe_transfers.status)"
show_error "$body"
if [ -n "$NEW_ACCT" ]; then
  body="$(stripe POST /v1/account_links     -d "account=$NEW_ACCT" -d type=account_onboarding     -d "return_url=https://example.com/connect-return?state=done"     -d "refresh_url=https://example.com/connect-return?state=refresh")"
  echo "    account_link url: $(present "$(field "$body" url)") expires_at=$(field "$body" expires_at)"
  show_error "$body"
  if [ -n "$(field "$body" url)" ]; then record g "PASS" "conta v2 + account link v1"; else record g "FAIL" "account link"; fi
else
  record g "FAIL" "criar conta BR v2"
fi

# ---------------------------------------------------------------------------
section "(h) Customer + SetupIntent"
body="$(stripe POST /v1/customers -d "email=spike.$RUN@example.com" -d "metadata[spike]=f8-h")"
CUS="$(field "$body" id)"
echo "    customer=$CUS"
show_error "$body"
if [ -n "$CUS" ]; then
  body="$(stripe POST /v1/setup_intents \
    -d "customer=$CUS" -d "automatic_payment_methods[enabled]=true" -d "automatic_payment_methods[allow_redirects]=never" -d usage=on_session \
    -d payment_method=pm_card_visa -d confirm=true)"
  echo "    setup_intent id=$(field "$body" id) status=$(field "$body" status) pm=$(field "$body" payment_method)"
  show_error "$body"
  body="$(stripe GET "/v1/customers/$CUS/payment_methods?type=card")"
  echo "    cartoes no customer: $(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let o;try{o=JSON.parse(s)}catch{o={}};console.log((o.data||[]).map(p=>`${p.card.brand} ${p.card.last4} ${p.card.exp_month}/${p.card.exp_year} funding=${p.card.funding}`).join("; ")||"nenhum")})')"
  if [ "$(field "$body" data.0.card.last4)" = "4242" ]; then record h "PASS" "customer + setup intent"; else record h "FAIL" "customer + setup intent"; fi
else
  record h "FAIL" "criar customer"
fi

# ---------------------------------------------------------------------------
section "Versões"
echo "    Stripe-Version da conta: ${STRIPE_VERSION:-desconhecida}"
echo "    npm stripe (latest): $(npm view stripe version 2>/dev/null || echo 'nao consultado')"

section "Resumo"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r id res note <<<"$r"
  printf '  %-5s %-5s %s\n' "$id" "$res" "$note"
done
