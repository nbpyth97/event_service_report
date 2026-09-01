"""Generate the security audit PDF report for the Meeting Scheduler project.

Usage: .venv/Scripts/python.exe generate_report.py
Regenerates relatorio-auditoria-seguranca.pdf in this directory.
"""

import io
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem,
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas

# ---------------------------------------------------------------------------
# Palette (as specified)
# ---------------------------------------------------------------------------
COL_CRIT = colors.HexColor("#B91C1C")
COL_HIGH = colors.HexColor("#EA580C")
COL_MED = colors.HexColor("#D97706")
COL_LOW = colors.HexColor("#2563EB")
COL_STRONG = colors.HexColor("#059669")
COL_INFO = colors.HexColor("#64748B")

SEV_COLOR = {
    "CRITICA": COL_CRIT,
    "ALTA": COL_HIGH,
    "MEDIA": COL_MED,
    "BAIXA": COL_LOW,
    "INFORMATIVA": COL_INFO,
}
SEV_LABEL = {
    "CRITICA": "Crítica",
    "ALTA": "Alta",
    "MEDIA": "Média",
    "BAIXA": "Baixa",
    "INFORMATIVA": "Informativa",
}

INK = colors.HexColor("#0F172A")
SUBTLE = colors.HexColor("#475569")
FAINT = colors.HexColor("#94A3B8")
BORDER = colors.HexColor("#E2E8F0")
BG = colors.HexColor("#F8FAFC")
CODE_BG = colors.HexColor("#0F172A")
CODE_FG = colors.HexColor("#E2E8F0")

REPORT_TITLE = "Relatório de Auditoria de Segurança — Meeting Scheduler"
TODAY = date(2026, 8, 31).strftime("%d/%m/%Y")

# ---------------------------------------------------------------------------
# Findings data
# ---------------------------------------------------------------------------
FINDINGS = [
    dict(
        id="F1", sev="CRITICA", cat="Banco sem tranca (RLS ausente)",
        title="Painel legado (dashboard/) lê dados de todos os tenants sem autenticação e sem RLS",
        files=["dashboard/src/App.jsx:192-194", "dashboard/src/supabaseClient.js:1-6"],
        desc=(
            "O painel administrativo legado (Supabase) não possui nenhuma tela de login nem chamada a "
            "supabase.auth — carrega os dados assim que a página abre. As três queries usam a anon key "
            "pública diretamente do navegador e filtram por tenant apenas no JavaScript do cliente "
            "(.eq('project_id', PROJECT_ID)), nunca no servidor:\n\n"
            "supabase.from('events').select('*').eq('project_id', PROJECT_ID)...\n"
            "supabase.from('clients').select('*').eq('project_id', PROJECT_ID)\n"
            "supabase.from('service_costs').select('*')   // sem filtro de tenant"
        ),
        why=(
            "O próprio CLAUDE.md do projeto documenta que esta SPA legada não tem RLS habilitada. Sem RLS, "
            "o PostgREST do Supabase aceita QUALQUER query da anon key, e o filtro .eq() é apenas uma "
            "conveniência da UI — não uma barreira. Qualquer pessoa com a anon key (pública por natureza, "
            "embutida no bundle JS e, além disso, já vazada no histórico do Git — ver F3) pode consultar a "
            "REST API do Supabase diretamente (curl/Postman) e ler ou alterar dados de QUALQUER tenant, "
            "sem login. A query de 'service_costs' nem sequer filtra por tenant no próprio código-fonte, "
            "expondo dados de custo/margem de todos os tenants a qualquer visitante da página."
        ),
        impact="Vazamento total de nomes e telefones de clientes (PII) e de dados financeiros (custo/preço de serviços) de todos os tenants, sem autenticação.",
        fix=(
            "1) Habilitar Row Level Security em todas as tabelas do Supabase usadas por este app "
            "(events, clients, service_costs, booking_requests) com políticas por project_id/tenant. "
            "2) Adicionar autenticação real ao painel (Supabase Auth) antes de qualquer leitura. "
            "3) Girar (rotate) a anon key comprometida e tratar como definitivo — a chave antiga já está no histórico do Git. "
            "4) Dado que o novo stack (src/backend + src/frontend, FastAPI/Postgres) já substitui este painel, priorizar a descontinuação/remoção de dashboard/ em vez de corrigi-lo."
        ),
        strength=False,
    ),
    dict(
        id="F2", sev="CRITICA", cat="Chaves expostas (hardcode / histórico Git)",
        title="Credenciais reais do Google OAuth (client_secret + refresh_token) commitadas e ainda recuperáveis no histórico do Git",
        files=["credentials_anabela.json (commit 164efb6)", "token_anabela.json (commit 164efb6)"],
        desc=(
            "O commit 164efb6 (\"first commit\") adicionou os arquivos credentials_anabela.json e "
            "token_anabela.json com um client_secret OAuth real do Google Cloud (projeto "
            "'cabeleireiro-calendario') e um refresh_token de escopo calendar.readonly. Os arquivos foram "
            "removidos de commits posteriores e hoje estão no .gitignore "
            "(credential_token/, credentials_*.json), mas o histórico do Git NÃO foi reescrito — "
            "'git show 164efb6:credentials_anabela.json' ainda recupera o segredo integralmente para "
            "qualquer pessoa com acesso de leitura ao repositório."
        ),
        why=(
            "Remover um arquivo em um commit posterior não apaga seu conteúdo do histórico — ele permanece "
            "acessível via git show/git log -p/git clone para qualquer colaborador, fork ou vazamento do "
            ".git. Isso já era conhecido pela equipe: i-need-to-create-adaptive-donut.md:248 registra "
            "explicitamente a tarefa pendente \"Remove credentials_anabela.json/token_anabela.json from "
            "git history, rotate the underlying Google OAuth credentials... treat the committed ones as "
            "compromised regardless of history rewrite\" — ou seja, a própria equipe já sinalizou o risco, "
            "mas a mitigação (rotação da credencial) não está confirmada como concluída no código."
        ),
        impact="Posse do client_secret + refresh_token permite a qualquer pessoa gerar access tokens válidos e ler o Google Calendar da conta do proprietário do negócio indefinidamente (refresh tokens não expiram por tempo, só por revogação).",
        fix=(
            "1) Girar IMEDIATAMENTE as credenciais no Google Cloud Console (revogar o client OAuth "
            "873257418071-...apps.googleusercontent.com e o refresh_token associado) — tratar como "
            "comprometidas independente de qualquer reescrita de histórico. "
            "2) Reescrever o histórico do Git (git filter-repo / BFG) para remover os blobs, cientes de que "
            "isso não anula a necessidade do passo 1. "
            "3) Nunca versionar arquivos de credenciais — usar variáveis de ambiente (como já é feito em "
            "booking-site/api/_lib/googleAuth.js) e confirmar que credentials_*.json/token_*.json seguem no "
            ".gitignore em todo o histórico futuro."
        ),
        strength=False,
    ),
    dict(
        id="F3", sev="MEDIA", cat="Chaves expostas (hardcode / histórico Git)",
        title="Chave pública (anon/publishable) e URL do Supabase commitadas no histórico do Git",
        files=[".env (commit 224ef52)", "dashboard/.env.local (commit f4a3370)"],
        desc=(
            "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (sb_publishable_...) foram commitados em .env e "
            "dashboard/.env.local. A anon key é, por design do Supabase, destinada a ser pública quando "
            "RLS está habilitada — mas como F1 mostra que RLS NÃO está habilitada neste projeto, esta "
            "chave funciona como uma chave mestra de leitura/escrita para todas as tabelas."
        ),
        why=(
            "Isoladamente (com RLS correta) isto seria apenas informativo. Combinado com F1 (RLS ausente), "
            "vira um vetor de acesso direto às tabelas — e o fato de já estar em texto plano no histórico "
            "do Git elimina qualquer dependência de extrair a chave do bundle JS: basta 'git log -p'."
        ),
        impact="Combinado com F1, permite leitura/escrita direta em todas as tabelas do Supabase deste projeto sem passar pela aplicação.",
        fix="Girar a anon key no painel do Supabase assim que a RLS de F1 for implementada, e nunca commitar arquivos .env (o .gitignore atual já bloqueia isso para commits futuros).",
        strength=False,
    ),
    dict(
        id="F4", sev="BAIXA", cat="Chaves expostas (hardcode)",
        title="SECRET_KEY de teste fixo nos workflows de CI",
        files=[".github/workflows/backend-tests.yml:31", ".github/workflows/ci.yml:31"],
        desc="SECRET_KEY: ci-test-secret está hardcoded nos dois workflows, usado apenas para assinar JWTs durante a execução de testes automatizados contra um Postgres efêmero do próprio job.",
        why="Sem impacto real: o valor nunca assina tokens de produção, e o Postgres do CI é descartado ao final do job. Reportado por completude da varredura de padrões 'secret ='.",
        impact="Nenhum em produção — escopo limitado ao ambiente efêmero do GitHub Actions.",
        fix="Opcional: mover para um GitHub Secret dedicado ao CI por consistência, mas não é uma correção urgente.",
        strength=False,
    ),
    dict(
        id="F5", sev="INFORMATIVA", cat="Chaves expostas (hardcode)",
        title="Senha padrão de seed local (\"changeme123\") e deploy via SSH com senha",
        files=["src/backend/app/scripts/seed.py:73", ".github/workflows/deploy.yml (uso de sshpass)"],
        desc=(
            "seed.py define DEFAULT_PASSWORD = \"changeme123\" para o admin de dados fictícios de "
            "desenvolvimento local (idempotente, cria a empresa 'Salão Anabela' apenas se não existir). "
            "Separadamente, o workflow de Deploy autentica no servidor via SSH usando senha "
            "(sshpass -e ssh ...) com a senha vinda de um GitHub Secret (SSH_PASSWORD), em vez de chave "
            "pública."
        ),
        why="O script de seed é claramente rotulado para desenvolvimento local e não é acionável via HTTP. O uso de sshpass com senha (mesmo vinda de secret) é uma prática menos robusta que autenticação por chave SSH — a senha transita como argumento de processo na máquina do runner.",
        impact="Baixo/nenhum para o seed (não é código de produção alcançável). O deploy via senha é uma questão de robustez, não uma chave exposta em código-fonte.",
        fix="Migrar o Deploy workflow para autenticação por chave SSH (deploy key dedicada) em vez de sshpass + senha.",
        strength=False,
    ),
    dict(
        id="F6", sev="BAIXA", cat="Inputs sem tratamento (dados sensíveis em trânsito)",
        title="Token de acesso JWT trafega como query string no endpoint SSE",
        files=["src/backend/app/routers/notifications.py:46-48"],
        desc=(
            "GET /api/notifications/stream?token=<jwt> recebe o access token via query string em vez do "
            "header Authorization, pois EventSource não permite headers customizados."
        ),
        why="Query strings ficam frequentemente registradas em logs de acesso (nginx access_log, já habilitado em infra/nginx/meeting-scheduler.conf), em headers Referer de eventuais navegações subsequentes, e no histórico do navegador — ampliando a superfície de exposição de um token de curta duração (10 min, ver core/config.py).",
        impact="Um access token de 10 minutos vazado por log/histórico permite personificar o usuário até expirar.",
        fix="Documentado como trade-off deliberado (limitação do EventSource) — mitigação razoável: garantir que o access_token_expire_minutes permaneça curto (já é 10 min) e considerar excluir explicitamente esta rota do log de acesso do nginx.",
        strength=False,
    ),
]

STRENGTHS = [
    dict(
        cat="Banco sem tranca / isolamento de tenant",
        title="Isolamento por tenant_id aplicado de forma consistente em toda a stack nova",
        evidence=(
            "Toda tabela multi-tenant (users, customers, services, agendamentos, notifications, "
            "refresh_tokens via user_id) tem tenant_id e toda query em repository.py (agendamentos, "
            "customers, services, notifications, companies) filtra explicitamente por tenant_id — nunca "
            "por join implícito. tenant_id vem sempre de current_user.tenant_id (JWT), nunca do corpo/URL "
            "da requisição, em agendamentos.py, services.py, customers.py, companies.py."
        ),
    ),
    dict(
        cat="Banco sem tranca / concorrência",
        title="Constraint de exclusão no Postgres cobre a janela de corrida do check de disponibilidade",
        evidence="ex_agendamentos_no_overlap (models.py:150-160, migração b7c4f19a2e30) impede duas reservas pending/confirmed sobrepostas por tenant mesmo sob concorrência, com fallback tratado como 409 em agendamentos/service.py:57-67.",
    ),
    dict(
        cat="IDOR",
        title="Todos os 8 routers autenticados revisados linha a linha não apresentam IDOR",
        evidence=(
            "agendamentos.py, services.py, customers.py, companies.py e notifications.py resolvem "
            "objeto-por-id sempre através de get_*(db, tenant_id, id) no domínio correspondente, que "
            "retorna 404 (não 403) quando o id pertence a outro tenant — testado explicitamente em "
            "test_services_router.py::test_update_other_tenants_service_404s e "
            "test_delete_other_tenants_service_404s."
        ),
    ),
    dict(
        cat="IDOR (app legado)",
        title="Confirmação/recusa de agendamento no booking-site protegida por token HMAC com comparação de tempo constante",
        evidence="api/_lib/token.js usa HMAC-SHA256 assinado com BOOKING_TOKEN_SECRET e crypto.timingSafeEqual — um id de booking sozinho (mesmo sequencial/adivinhável) não é suficiente para confirmar/recusar outra reserva.",
    ),
    dict(
        cat="Permissão definida no navegador",
        title="Não há sistema de papéis nem em frontend nem em backend — não há gate para cruzar",
        evidence="core/models.py::User não tem coluna role; ProtectedRoute.tsx só verifica presença de usuário autenticado; toda rota staff exige get_current_user no backend (main.py:30-33). Não há isAdmin/canEdit em nenhum componente do frontend novo.",
    ),
    dict(
        cat="Chaves expostas",
        title="Nenhuma credencial de produção hardcoded no código-fonte atual da stack nova",
        evidence="core/config.py exige SECRET_KEY, POSTGRES_PASSWORD via variáveis de ambiente sem valor padrão (Settings() falha ao subir se ausente); .env real está no .gitignore e nunca foi commitado; apenas .env.example com placeholders 'changeme' está versionado.",
    ),
    dict(
        cat="Inputs sem tratamento (XSS)",
        title="Frontend novo não usa nenhuma API de renderização de HTML bruto",
        evidence="Busca por dangerouslySetInnerHTML/innerHTML/eval/new Function/v-html em todo src/frontend/src retornou zero ocorrências — toda renderização passa pelo escaping automático do React (JSX).",
    ),
    dict(
        cat="Inputs sem tratamento (XSS)",
        title="Página HTML gerada pelo app legado (booking-site) escapa toda entrada do usuário",
        evidence="api/_lib/renderPage.js:1-8 define escapeHtml() e a aplica em todo valor interpolado (title, message, detalhes do cliente/serviço/telefone) antes de montar a página de confirmar/recusar.",
    ),
    dict(
        cat="Inputs sem tratamento (XSS) / hardening de rede",
        title="Content-Security-Policy estrita e cabeçalhos de segurança completos no nginx",
        evidence="infra/nginx/meeting-scheduler.conf:56-67 define CSP (default-src 'self', script-src 'self', object-src 'none', frame-ancestors 'none'), HSTS, X-Content-Type-Options, X-Frame-Options e Referrer-Policy em todas as localizações relevantes; rate limiting dedicado em /api/auth/login e /api/auth/refresh.",
    ),
    dict(
        cat="Autenticação",
        title="Refresh token com revogação real no servidor e cookie httpOnly",
        evidence="RefreshToken (models.py) com jti/revoked_at/expires_at verificados em auth/service.py::rotate_refresh_token; cookie httpOnly+SameSite=strict com path restrito a /api/auth (core/auth.py:55-64); access token mantido só em memória no frontend (auth.ts:7-9), nunca em localStorage.",
    ),
    dict(
        cat="Cobertura de testes",
        title="Suíte de testes automatizados cobre isolamento cross-tenant",
        evidence="14 arquivos de teste em src/backend/tests/, incluindo casos explícitos de acesso cross-tenant retornando 404 (test_services_router.py) e testes de fluxo completo de auth/refresh.",
    ),
]

RECOMMENDATIONS = [
    ("P1", "Girar as credenciais Google OAuth comprometidas (client_secret + refresh_token de credentials_anabela.json/token_anabela.json) no Google Cloud Console — ação imediata, independente de qualquer outra correção.", "F2"),
    ("P1", "Habilitar Row Level Security em todas as tabelas Supabase usadas por dashboard/ e booking-site (events, clients, service_costs, booking_requests), com políticas por project_id.", "F1"),
    ("P1", "Adicionar autenticação real (Supabase Auth ou equivalente) ao painel dashboard/ antes de qualquer leitura de dados.", "F1"),
    ("P2", "Girar a anon key do Supabase após a RLS estar em vigor, e reescrever o histórico do Git para remover os blobs de credenciais (cientes de que isso não substitui a rotação).", "F2, F3"),
    ("P2", "Priorizar a descontinuação de dashboard/ e booking-site/ em favor do novo stack FastAPI/React, que já resolve o isolamento de tenant corretamente.", "F1"),
    ("P3", "Migrar o workflow de Deploy de autenticação SSH por senha (sshpass) para chave SSH dedicada.", "F5"),
    ("P3", "Excluir a rota /api/notifications/stream do access_log do nginx, já que o token de acesso trafega na query string.", "F6"),
    ("P3", "Mover SECRET_KEY do CI para um GitHub Secret dedicado por consistência (sem risco real atual).", "F4"),
]

# ---------------------------------------------------------------------------
# Chart generation
# ---------------------------------------------------------------------------

def make_donut_chart():
    order = ["CRITICA", "ALTA", "MEDIA", "BAIXA", "INFORMATIVA"]
    counts = {k: 0 for k in order}
    for f in FINDINGS:
        counts[f["sev"]] += 1
    labels = [SEV_LABEL[k] for k in order if counts[k] > 0]
    sizes = [counts[k] for k in order if counts[k] > 0]
    color_hexes = [SEV_COLOR[k].hexval().replace("0x", "#") for k in order if counts[k] > 0]

    fig, ax = plt.subplots(figsize=(4.4, 4.4), dpi=200)
    wedges, _texts = ax.pie(
        sizes, colors=color_hexes, startangle=90, counterclock=False,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
    )
    total = sum(sizes)
    ax.text(0, 0.08, str(total), ha="center", va="center", fontsize=26, fontweight="bold", color="#0F172A")
    ax.text(0, -0.18, "achados", ha="center", va="center", fontsize=11, color="#475569")
    ax.set_aspect("equal")

    handles = wedges
    leg_labels = [f"{lab} ({n})" for lab, n in zip(labels, sizes)]
    ax.legend(handles, leg_labels, loc="center left", bbox_to_anchor=(1.02, 0.5), frameon=False, fontsize=10)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return buf


def make_bar_chart():
    cat_order = [
        "Banco sem tranca (RLS ausente)",
        "Chaves expostas (hardcode / histórico Git)",
        "Chaves expostas (hardcode)",
        "Inputs sem tratamento (dados sensíveis em trânsito)",
    ]
    cat_short = {
        "Banco sem tranca (RLS ausente)": "Banco sem\ntranca",
        "Chaves expostas (hardcode / histórico Git)": "Chaves expostas\n(histórico Git)",
        "Chaves expostas (hardcode)": "Chaves expostas\n(hardcode)",
        "Inputs sem tratamento (dados sensíveis em trânsito)": "Inputs sem\ntratamento",
    }
    counts = {c: [0, 0, 0, 0, 0] for c in cat_short}  # crit, high, med, low, info
    sev_idx = {"CRITICA": 0, "ALTA": 1, "MEDIA": 2, "BAIXA": 3, "INFORMATIVA": 4}
    for f in FINDINGS:
        counts[f["cat"]][sev_idx[f["sev"]]] += 1

    labels = [cat_short[c] for c in cat_short]
    sev_names = ["Crítica", "Alta", "Média", "Baixa", "Informativa"]
    sev_colors = [COL_CRIT, COL_HIGH, COL_MED, COL_LOW, COL_INFO]
    hexes = [c.hexval().replace("0x", "#") for c in sev_colors]

    fig, ax = plt.subplots(figsize=(6.6, 4.0), dpi=200)
    x = range(len(labels))
    bottoms = [0] * len(labels)
    for i, sev_name in enumerate(sev_names):
        vals = [counts[c][i] for c in cat_short]
        if sum(vals) == 0:
            continue
        ax.bar(x, vals, bottom=bottoms, color=hexes[i], label=sev_name, width=0.55)
        bottoms = [b + v for b, v in zip(bottoms, vals)]

    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=9, color="#0F172A")
    ax.set_ylabel("Nº de achados", fontsize=10, color="#475569")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#E2E8F0")
    ax.spines["bottom"].set_color("#E2E8F0")
    ax.tick_params(colors="#475569")
    max_total = max(sum(counts[c]) for c in cat_short) or 1
    ax.set_yticks(range(0, max_total + 1))
    ax.legend(loc="upper right", frameon=False, fontsize=8, ncol=1)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
styles = getSampleStyleSheet()

style_title = ParagraphStyle("TitleBig", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25,
                              leading=30, textColor=INK, spaceAfter=6, alignment=TA_LEFT)
style_subtitle = ParagraphStyle("SubtitleBig", parent=styles["Normal"], fontName="Helvetica", fontSize=13,
                                 leading=18, textColor=SUBTLE, spaceAfter=4)
style_h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=17,
                           leading=21, textColor=INK, spaceBefore=4, spaceAfter=10)
style_h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13,
                           leading=17, textColor=INK, spaceBefore=12, spaceAfter=6)
style_h3 = ParagraphStyle("H3", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=11,
                           leading=15, textColor=INK, spaceBefore=8, spaceAfter=4)
style_body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=9.3,
                             leading=13.5, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6)
style_body_small = ParagraphStyle("BodySmall", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5,
                                   leading=12.5, textColor=SUBTLE, alignment=TA_JUSTIFY, spaceAfter=4)
style_meta = ParagraphStyle("Meta", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5,
                             leading=14, textColor=SUBTLE)
style_code = ParagraphStyle("Code", parent=styles["Normal"], fontName="Courier", fontSize=8, leading=11.5,
                             textColor=CODE_FG, backColor=CODE_BG, borderPadding=(6, 8, 6, 8),
                             spaceAfter=6, spaceBefore=2)
style_file = ParagraphStyle("FileRef", parent=styles["Normal"], fontName="Courier", fontSize=8.3, leading=12,
                             textColor=INK)
style_table_cell = ParagraphStyle("TableCell", parent=styles["Normal"], fontName="Helvetica", fontSize=8.2,
                                   leading=11.5, textColor=INK)
style_table_cell_file = ParagraphStyle("TableCellFile", parent=styles["Normal"], fontName="Courier", fontSize=7.6,
                                        leading=10.5, textColor=INK)
style_issue_h = ParagraphStyle("IssueH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10,
                                leading=13, textColor=INK, spaceBefore=4, spaceAfter=3)
style_issue_body = ParagraphStyle("IssueBody", parent=styles["Normal"], fontName="Courier", fontSize=7.6,
                                   leading=11, textColor=INK)


def sev_chip(sev):
    label = SEV_LABEL[sev]
    color = SEV_COLOR[sev]
    t = Table([[label]], colWidths=[2.6 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


class HeaderFooterCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, **kwargs):
        pdfcanvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for i, state in enumerate(self._saved_page_states):
            self.__dict__.update(state)
            self._draw_header_footer(i + 1, num_pages)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def _draw_header_footer(self, page_num, total_pages):
        if page_num == 1:
            return
        w, h = A4
        self.setFont("Helvetica", 7.5)
        self.setFillColor(FAINT)
        self.drawString(2 * cm, h - 1.15 * cm, "Relatório de Auditoria de Segurança — Meeting Scheduler")
        self.drawRightString(w - 2 * cm, h - 1.15 * cm, TODAY)
        self.setStrokeColor(BORDER)
        self.line(2 * cm, h - 1.3 * cm, w - 2 * cm, h - 1.3 * cm)
        self.line(2 * cm, 1.5 * cm, w - 2 * cm, 1.5 * cm)
        self.drawString(2 * cm, 1.05 * cm, "docs/security-audit/relatorio-auditoria-seguranca.pdf")
        self.drawRightString(w - 2 * cm, 1.05 * cm, f"Página {page_num} de {total_pages}")


def build():
    doc = BaseDocTemplate(
        "relatorio-auditoria-seguranca.pdf",
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
        title=REPORT_TITLE,
    )
    frame_cover = Frame(2 * cm, 2 * cm, doc.width, doc.height, id="cover")
    frame_normal = Frame(2 * cm, 1.9 * cm, doc.width, doc.height - 0.6 * cm, id="normal")
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[frame_cover]),
        PageTemplate(id="Normal", frames=[frame_normal]),
    ])

    story = []

    # ---------------- Cover ----------------
    story.append(Spacer(1, 3.2 * cm))
    story.append(Paragraph("MEETING SCHEDULER · SEGURANÇA", ParagraphStyle(
        "Eyebrow", fontName="Helvetica-Bold", fontSize=10, textColor=COL_LOW, spaceAfter=14)))
    story.append(Paragraph("Relatório de Auditoria de Segurança", style_title))
    story.append(Paragraph("Meeting Scheduler — Booking SaaS multi-tenant (event_service_report)", style_subtitle))
    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=14))

    meta_rows = [
        ["Data do relatório", TODAY],
        ["Repositório", "meeting-scheduler / event_service_report"],
        ["Branch auditada", "main"],
        ["Stack detectada", "FastAPI + SQLAlchemy async (asyncpg) + Postgres 16, JWT (sem papéis) — "
                             "backend novo; React + TypeScript + Vite — frontend novo; Docker Compose + "
                             "nginx + GitHub Actions — deploy; Node.js/Vercel + Supabase (legado, "
                             "dashboard/ e booking-site/)"],
        ["Escopo", "Código-fonte completo em src/backend e src/frontend (stack novo), o app legado "
                   "Supabase em dashboard/ e booking-site/, arquivos de infraestrutura "
                   "(docker-compose.yml, infra/nginx, .github/workflows) e histórico completo do Git"],
    ]
    meta_table = Table(
        [[Paragraph(f"<b>{k}</b>", style_meta), Paragraph(v, style_meta)] for k, v in meta_rows],
        colWidths=[3.6 * cm, doc.width - 3.6 * cm],
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.8 * cm))

    story.append(Paragraph("Nota metodológica", style_h3))
    story.append(Paragraph(
        "Cada uma das cinco categorias solicitadas foi mapeada para o mecanismo equivalente na stack "
        "detectada, dado que o repositório contém dois sistemas distintos: (1) um backend/frontend novo "
        "em FastAPI + Postgres + React, sem RLS nativa — isolamento de tenant é feito por filtro explícito "
        "de tenant_id na camada de serviço/repositório; e (2) um app legado em substituição, que usa "
        "Supabase diretamente do navegador (onde o mecanismo de isolamento seria Row Level Security). "
        "'Banco sem tranca' foi avaliado como RLS ausente/furada no app Supabase e como ausência/presença "
        "de filtro de tenant_id explícito no app FastAPI. 'Permissão definida no navegador' foi avaliado "
        "considerando que a stack nova não possui sistema de papéis (User não tem coluna role — todo "
        "usuário autenticado é administrador do seu próprio tenant), portanto não há gate de papel "
        "frontend↔backend para cruzar; documentado explicitamente como não aplicável nesse sentido. "
        "'IDOR' foi verificado em todos os handlers de rota dos dois backends, um por um. 'Chaves "
        "expostas' incluiu uma varredura do código-fonte atual E do histórico completo do Git "
        "(git log --all), já que segredos removidos de commits recentes podem permanecer recuperáveis. "
        "'Inputs sem tratamento (XSS)' cobriu o React novo (dangerouslySetInnerHTML/innerHTML/eval) e a "
        "geração de HTML server-side do app legado (booking-site/api/_lib/renderPage.js).",
        style_body_small,
    ))

    story.append(Spacer(1, 0.9 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "Uso restrito. Este relatório contém referências a segredos comprometidos (Seção b/d) — os "
        "valores reais foram mascarados; a evidência completa está disponível nos commits do Git "
        "referenciados. Recomenda-se tratar este PDF com a mesma confidencialidade do repositório.",
        ParagraphStyle("Warn", parent=style_body_small, textColor=COL_HIGH),
    ))

    story.append(PageBreak())

    # ---------------- Executive summary ----------------
    story[-1] = story[-1]  # no-op, keep structure clear
    story.append(NextTemplate("Normal"))
    story.append(Paragraph("Resumo executivo", style_h1))

    sev_counts = {}
    for f in FINDINGS:
        sev_counts[f["sev"]] = sev_counts.get(f["sev"], 0) + 1
    order = ["CRITICA", "ALTA", "MEDIA", "BAIXA", "INFORMATIVA"]
    summary_cells = []
    for s in order:
        n = sev_counts.get(s, 0)
        summary_cells.append(Paragraph(
            f"<font color='{SEV_COLOR[s].hexval().replace('0x','#')}'><b>{n}</b></font><br/>"
            f"<font size=7.5 color='#475569'>{SEV_LABEL[s]}</font>",
            ParagraphStyle("SumCell", fontName="Helvetica-Bold", fontSize=18, alignment=TA_CENTER, leading=20),
        ))
    sum_table = Table([summary_cells], colWidths=[doc.width / 5.0] * 5)
    sum_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        f"Total de {len(FINDINGS)} achados classificados, além de {len(STRENGTHS)} pontos fortes "
        "verificados com evidência de código. O risco central da auditoria concentra-se inteiramente no "
        "app legado em substituição (dashboard/ e credenciais commitadas no histórico do Git) — a stack "
        "nova (FastAPI/Postgres/React) não apresentou achados de isolamento de tenant, IDOR ou XSS.",
        style_body,
    ))

    story.append(Spacer(1, 0.3 * cm))
    donut_buf = make_donut_chart()
    bar_buf = make_bar_chart()
    chart_table = Table(
        [[Image(donut_buf, width=7.6 * cm, height=6.6 * cm), Image(bar_buf, width=9.0 * cm, height=5.6 * cm)]],
        colWidths=[7.8 * cm, 9.2 * cm],
    )
    chart_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(Paragraph("Distribuição por severidade e por categoria", style_h3))
    story.append(chart_table)

    story.append(PageBreak())

    # ---------------- Strengths & weaknesses ----------------
    story.append(Paragraph("Pontos fortes", style_h1))
    story.append(Paragraph(
        "Práticas de segurança verificadas no código, com a evidência que comprova cada uma — "
        "isso também demonstra a cobertura desta auditoria.",
        style_body,
    ))
    for s in STRENGTHS:
        block = [
            Paragraph(f"<font color='{COL_STRONG.hexval().replace('0x','#')}'>●</font> <b>{s['title']}</b> "
                      f"<font size=7.5 color='#94A3B8'>[{s['cat']}]</font>", style_h3),
            Paragraph(s["evidence"], style_body_small),
        ]
        story.append(KeepTogether(block))
        story.append(Spacer(1, 3))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Pontos fracos (riscos centrais)", style_h1))
    weak_summary = [
        "Isolamento de tenant no app Supabase legado depende inteiramente de RLS, que está desabilitada — "
        "qualquer chamada direta à API do Supabase com a anon key ignora o filtro de tenant da UI (F1).",
        "Segredos reais (OAuth do Google) foram commitados e continuam recuperáveis do histórico do Git "
        "mesmo após remoção em commits posteriores — a equipe já havia identificado isso internamente, "
        "mas não há confirmação de rotação (F2).",
        "A chave pública do Supabase, combinada com a ausência de RLS, funciona como uma chave mestra de "
        "acesso a todas as tabelas do app legado (F3).",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(w, style_body), leftIndent=6) for w in weak_summary],
        bulletType="bullet", start="•", leftIndent=14,
    ))

    story.append(PageBreak())

    # ---------------- Detailed findings table ----------------
    story.append(Paragraph("Achados detalhados", style_h1))
    header = [
        Paragraph("<b>Sev.</b>", style_table_cell),
        Paragraph("<b>Arquivo:linha</b>", style_table_cell),
        Paragraph("<b>Descrição</b>", style_table_cell),
    ]
    rows = [header]
    for f in FINDINGS:
        files_html = "<br/>".join(f["files"])
        rows.append([
            sev_chip(f["sev"]),
            Paragraph(files_html, style_table_cell_file),
            Paragraph(f"<b>{f['id']} — {f['title']}</b><br/>{f['desc'].splitlines()[0]}", style_table_cell),
        ])
    findings_table = Table(rows, colWidths=[2.6 * cm, 4.6 * cm, doc.width - 7.2 * cm], repeatRows=1)
    findings_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BG),
        ("LINEBELOW", (0, 0), (-1, 0), 1, BORDER),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(findings_table)

    story.append(PageBreak())

    # ---------------- Findings full detail per category ----------------
    story.append(Paragraph("Achados — detalhe completo por categoria", style_h1))
    categories_seen = []
    for f in FINDINGS:
        if f["cat"] not in categories_seen:
            categories_seen.append(f["cat"])
    for cat in categories_seen:
        story.append(Paragraph(cat, style_h2))
        for f in [x for x in FINDINGS if x["cat"] == cat]:
            head_row = Table(
                [[sev_chip(f["sev"]), Paragraph(f"<b>{f['id']} — {f['title']}</b>", style_h3)]],
                colWidths=[2.6 * cm, doc.width - 2.6 * cm],
            )
            head_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
            story.append(head_row)
            story.append(Paragraph("<b>Arquivo(s):</b> " + " · ".join(f["files"]), style_file))
            story.append(Spacer(1, 3))
            desc_html = f["desc"].replace("\n\n", "<br/><br/>").replace("\n", "<br/>")
            story.append(Paragraph(desc_html, style_code))
            story.append(Paragraph("<b>Por que é explorável:</b> " + f["why"], style_body_small))
            story.append(Paragraph("<b>Impacto:</b> " + f["impact"], style_body_small))
            story.append(Paragraph("<b>Correção sugerida:</b> " + f["fix"], style_body_small))
            story.append(Spacer(1, 8))

    story.append(PageBreak())

    # ---------------- Recommendations ----------------
    story.append(Paragraph("Recomendações priorizadas", style_h1))
    rec_rows = [[Paragraph("<b>Prio.</b>", style_table_cell), Paragraph("<b>Ação</b>", style_table_cell),
                 Paragraph("<b>Achados</b>", style_table_cell)]]
    prio_color = {"P1": COL_CRIT, "P2": COL_HIGH, "P3": COL_LOW}
    for prio, action, refs in RECOMMENDATIONS:
        chip = Table([[prio]], colWidths=[1.3 * cm])
        chip.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), prio_color[prio]),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        rec_rows.append([chip, Paragraph(action, style_table_cell), Paragraph(refs, style_table_cell_file)])
    rec_table = Table(rec_rows, colWidths=[1.6 * cm, doc.width - 5.1 * cm, 3.5 * cm], repeatRows=1)
    rec_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BG),
        ("LINEBELOW", (0, 0), (-1, 0), 1, BORDER),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(rec_table)

    story.append(PageBreak())

    # ---------------- GitHub issues ----------------
    story.append(Paragraph("Issues para o GitHub", style_h1))
    story.append(Paragraph(
        "Texto completo de cada issue, pronto para copiar e colar. Achados triviais relacionados "
        "(F4 e F5, ambos de baixo impacto e mesma categoria) foram agrupados em uma única issue.",
        style_body,
    ))

    def issue_block(n, md_text):
        story.append(Paragraph(f"--- ISSUE {n} ---", style_issue_h))
        for line in md_text.strip("\n").split("\n"):
            story.append(Paragraph(_escape(line) or "&nbsp;", style_issue_body))
        story.append(Paragraph(f"--- FIM ISSUE {n} ---", style_issue_h))
        story.append(Spacer(1, 10))

    issue1 = """
[Segurança] Painel legado (dashboard/) expõe dados de todos os tenants sem autenticação (RLS ausente)

Labels sugeridas: security, critical

## Problema
O painel administrativo legado em `dashboard/src/App.jsx` não possui tela de login nem chamada a
`supabase.auth` — carrega os dados diretamente ao montar o componente, usando a anon key pública do
Supabase no navegador. O isolamento por tenant é feito apenas com `.eq('project_id', PROJECT_ID)` no
JavaScript do cliente, e a query de `service_costs` nem sequer aplica esse filtro. Como o projeto não
tem Row Level Security habilitada (confirmado em CLAUDE.md), o filtro do cliente não é uma barreira real:
qualquer pessoa com a anon key pode consultar a REST API do Supabase diretamente e ler dados de
QUALQUER tenant.

## Por que é explorável
Sem RLS, o PostgREST aceita qualquer query autenticada com a anon key, independente do que a UI decide
mostrar. A anon key é pública por natureza (embutida no bundle JS) e, adicionalmente, já está no
histórico do Git (ver issue de credenciais).

## Evidência
dashboard/src/App.jsx:192-194
```
supabase.from('events').select('*').eq('project_id', PROJECT_ID).order('event_start_time', {ascending:false}),
supabase.from('clients').select('*').eq('project_id', PROJECT_ID),
supabase.from('service_costs').select('*'),
```
dashboard/src/supabaseClient.js:1-6 (cliente instanciado só com a anon key, sem sessão)

## Impacto
Vazamento de PII de clientes (nome, telefone) e de dados financeiros (custo/preço) de todos os tenants,
sem exigir login.

## Sugestão de correção
- Habilitar RLS em `events`, `clients`, `service_costs` e `booking_requests` com políticas por
  `project_id`.
- Adicionar autenticação real ao painel antes de qualquer leitura.
- Girar a anon key do Supabase.
- Avaliar descontinuar `dashboard/` em favor do stack novo (FastAPI + React), que já resolve isolamento
  de tenant corretamente.

## Critérios de aceite
- [ ] RLS habilitada e testada nas 4 tabelas listadas
- [ ] Painel exige login válido antes de renderizar qualquer dado
- [ ] Anon key rotacionada
- [ ] Consulta direta à REST API do Supabase sem sessão de tenant correto retorna vazio/erro
"""
    issue_block(1, issue1)

    issue2 = """
[Segurança] Credenciais reais do Google OAuth commitadas e recuperáveis no histórico do Git

Labels sugeridas: security, critical

## Problema
O commit `164efb6` ("first commit") incluiu `credentials_anabela.json` e `token_anabela.json` com um
client_secret OAuth real do Google Cloud e um refresh_token de escopo `calendar.readonly`. Os arquivos
foram removidos e hoje estão no `.gitignore`, mas o histórico do Git não foi reescrito — o segredo
continua totalmente recuperável.

## Por que é explorável
Remover um arquivo em um commit posterior não apaga seu conteúdo do histórico do Git; qualquer pessoa
com `git clone`/acesso de leitura ao repositório pode rodar `git show 164efb6:credentials_anabela.json`
e obter o client_secret e o refresh_token na íntegra. Isso já havia sido identificado internamente
(`i-need-to-create-adaptive-donut.md:248`), mas não há confirmação de que a rotação foi concluída.

## Evidência
- Commit `164efb6`, arquivo `credentials_anabela.json` (client_secret do projeto Google Cloud
  "cabeleireiro-calendario")
- Commit `164efb6`, arquivo `token_anabela.json` (refresh_token com escopo
  `https://www.googleapis.com/auth/calendar.readonly`)
- Valores reais mascarados neste relatório por prudência — ver os commits para os valores completos.

## Impacto
Posse do client_secret + refresh_token permite gerar access tokens válidos e ler o Google Calendar da
conta associada indefinidamente, até revogação manual.

## Sugestão de correção
- Girar/revogar imediatamente as credenciais no Google Cloud Console — tratar como comprometidas
  independentemente de qualquer reescrita de histórico.
- Reescrever o histórico do Git (git filter-repo/BFG) para remover os blobs.
- Confirmar que nenhum outro script local usa esses arquivos versionados; usar variáveis de ambiente
  (padrão já seguido em `booking-site/api/_lib/googleAuth.js`).

## Critérios de aceite
- [ ] Client OAuth antigo revogado no Google Cloud Console
- [ ] Novo client/segredo gerado e distribuído apenas via variável de ambiente/secret manager
- [ ] Histórico do Git reescrito e force-pushed (com aviso à equipe sobre re-clone)
- [ ] Verificação de que nenhum serviço em produção ainda referencia as credenciais antigas
"""
    issue_block(2, issue2)

    issue3 = """
[Segurança] Chave pública do Supabase commitada no histórico do Git (agravada pela ausência de RLS)

Labels sugeridas: security, medium

## Problema
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` foram commitados em `.env` (commit `224ef52`) e
`dashboard/.env.local` (commit `f4a3370`). Isoladamente a anon key é pública por design do Supabase,
mas combinada com a ausência de RLS (ver issue do dashboard) ela funciona como uma chave mestra de
leitura/escrita.

## Por que é explorável
Estar em texto plano no histórico do Git elimina a necessidade de extrair a chave do bundle JS — basta
`git log -p` para obtê-la, além de já estar embutida publicamente no frontend.

## Evidência
- `.env`, commit `224ef52`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `dashboard/.env.local`, commit `f4a3370`: mesmos valores

## Impacto
Combinado com a issue de RLS ausente, permite leitura/escrita direta em todas as tabelas do projeto
Supabase sem passar pela aplicação.

## Sugestão de correção
- Girar a anon key assim que a RLS estiver em vigor.
- Confirmar que `.env`/`.env.local` seguem no `.gitignore` (já estão) para todo commit futuro.

## Critérios de aceite
- [ ] Anon key rotacionada após RLS habilitada
- [ ] Nenhum novo commit futuro reintroduz arquivos `.env*`
"""
    issue_block(3, issue3)

    issue4 = """
[Segurança] Segredos de baixo risco: SECRET_KEY fixo no CI e deploy via SSH com senha

Labels sugeridas: security, low

## Problema
Dois itens de menor severidade agrupados por serem do mesmo tema (segredos/credenciais em automação,
sem exposição de dados de produção):

1. `SECRET_KEY: ci-test-secret` está hardcoded em `.github/workflows/backend-tests.yml:31` e
   `.github/workflows/ci.yml:31`, usado apenas para assinar JWTs durante testes contra um Postgres
   efêmero do próprio job.
2. `.github/workflows/deploy.yml` autentica no servidor de deploy via `sshpass` + senha (vinda de um
   GitHub Secret `SSH_PASSWORD`), em vez de autenticação por chave SSH.

## Por que é explorável
(1) Sem impacto real — nunca assina tokens de produção e o ambiente é descartado ao fim do job.
(2) Autenticação por senha via `sshpass` é uma prática menos robusta que chave SSH — a senha transita
como argumento de processo no runner, ainda que vinda de um secret do GitHub.

## Evidência
- `.github/workflows/backend-tests.yml:31`, `.github/workflows/ci.yml:31`: `SECRET_KEY: ci-test-secret`
- `.github/workflows/deploy.yml`: `sshpass -e ssh -p 1111 ... "${{ secrets.SSH_USER }}@${{ secrets.HOST }}"`

## Impacto
Baixo/nenhum em produção. Item (2) é uma questão de robustez de infraestrutura, não uma chave exposta
em código-fonte.

## Sugestão de correção
- (1) Opcional: mover para um GitHub Secret dedicado ao CI, por consistência.
- (2) Migrar para autenticação por chave SSH dedicada (deploy key) no lugar de `sshpass` + senha.

## Critérios de aceite
- [ ] SECRET_KEY de CI passa a vir de um secret dedicado (ou justificativa documentada para mantê-lo fixo)
- [ ] Deploy usa chave SSH em vez de senha
"""
    issue_block(4, issue4)

    issue5 = """
[Segurança] Token de acesso JWT trafega como query string no endpoint SSE de notificações

Labels sugeridas: security, low

## Problema
`GET /api/notifications/stream?token=<jwt>` recebe o access token via query string em vez do header
`Authorization`, porque a API `EventSource` do navegador não permite headers customizados.

## Por que é explorável
Query strings costumam ficar registradas em logs de acesso (o nginx do projeto já tem `access_log`
habilitado), em headers `Referer` de navegações subsequentes e no histórico do navegador — ampliando a
superfície de exposição de um token válido.

## Evidência
src/backend/app/routers/notifications.py:46-48
```
@router.get("/stream")
async def stream_notifications(request: Request, token: str, db: AsyncSession = Depends(get_db)):
    user = await _get_sse_user(token, db)
```

## Impacto
Um access token vazado por log/histórico permite personificar o usuário até expirar. O risco é
parcialmente mitigado pela curta duração do token (`access_token_expire_minutes = 10`, ver
`core/config.py`).

## Sugestão de correção
- Excluir explicitamente esta rota do `access_log` do nginx
  (`infra/nginx/meeting-scheduler.conf`, location `/api/notifications/stream`).
- Manter o `access_token_expire_minutes` curto (já está em 10 minutos).

## Critérios de aceite
- [ ] Location do nginx para `/api/notifications/stream` desabilita access_log
- [ ] Confirmado que o token continua expirando em <= 10 minutos
"""
    issue_block(5, issue5)

    doc.build(story, canvasmaker=HeaderFooterCanvas)


def _escape(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# NextTemplate needs importing at module load; keep local import to avoid unused warning if refactored
from reportlab.platypus.doctemplate import NextPageTemplate as NextTemplate  # noqa: E402

if __name__ == "__main__":
    build()
    print("PDF gerado: relatorio-auditoria-seguranca.pdf")
