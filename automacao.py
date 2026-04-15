import time
import threading
import subprocess
import os
import requests
import mysql.connector
from datetime import datetime
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Permite requisições do PWA (qualquer origem)

# =============================================================================
# CONFIGURAÇÃO DE CAMINHOS (ajuste para o seu ambiente Windows)
# =============================================================================
FFMPEG_PATH    = "C:\\ffmpeg\\bin\\ffmpeg.exe"
PIPER_PATH     = "C:\\piper\\piper.exe"
MODELO_VOZ     = "C:\\piper\\voz\\pt_BR-faber-medium.onnx"
PASTA_TRABALHO = "C:\\homilias"

# IP público da VPS (substitua pelo IP real da sua máquina)
MEU_IP = "SEU_IP"   # <-- ALTERE AQUI

# =============================================================================
# CONFIGURAÇÃO MYSQL
# =============================================================================
DB_CONFIG = {
    "host":     "localhost",
    "user":     "bot_igreja",
    "password": "MinhaSenha123",  # <-- use a mesma senha do bot.sql
    "database": "paroquia_db",
    "charset":  "utf8mb4",
}

def get_db():
    """Retorna uma nova conexão MySQL."""
    return mysql.connector.connect(**DB_CONFIG)

def db_exec(sql, params=None, fetch=False):
    """Helper: executa SQL e retorna resultados opcionalmente."""
    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    cur.execute(sql, params or ())
    result = cur.fetchall() if fetch else None
    conn.commit()
    cur.close()
    conn.close()
    return result

# =============================================================================
# FUNÇÃO: BUSCAR LITURGIA CANÇÃO NOVA
# =============================================================================
def buscar_liturgia_cancao_nova():
    print("-> Buscando liturgia na Canção Nova...")
    url     = "https://liturgia.cancaonova.com/pb/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, 'html.parser')

        titulo = f"Liturgia Diária – {datetime.now().strftime('%d/%m/%Y')}"

        # Tenta o div de conteúdo da liturgia
        conteudo_div = soup.find("div", {"class": "content-liturgia"})
        if not conteudo_div:
            conteudo_div = soup.find("div", {"id": "liturgia-4"})
        if not conteudo_div:
            for h2 in soup.find_all("h2"):
                if "Evangelho" in h2.get_text():
                    conteudo_div = h2.find_parent()
                    break

        if conteudo_div:
            texto = conteudo_div.get_text(separator="\n", strip=True)
            if len(texto) > 50:
                return titulo, texto
    except Exception as e:
        print(f"Erro ao buscar liturgia: {e}")
    return None, None

# =============================================================================
# FUNÇÃO: FAXINA SEMANAL (remove registros concluídos com mais de 7 dias)
# =============================================================================
def faxina_semanal():
    print("-> Executando faxina semanal...")
    try:
        limite = int(time.time()) - (7 * 24 * 60 * 60)
        antigos = db_exec(
            "SELECT id FROM homilias WHERE id < %s AND status = 'concluido'",
            (limite,), fetch=True
        )
        for row in antigos:
            item_id = row['id']
            for nome in [f"audio_{item_id}.wav", f"homilia_{item_id}.mp4"]:
                caminho = os.path.join(PASTA_TRABALHO, nome)
                if os.path.exists(caminho):
                    os.remove(caminho)
            db_exec("DELETE FROM homilias WHERE id = %s", (item_id,))
            print(f"-> Removido registro antigo ID: {item_id}")
    except Exception as e:
        print(f"Erro na faxina: {e}")

# =============================================================================
# PROCESSAMENTO DE ÁUDIO E VÍDEO
# =============================================================================
def processar_item(item):
    """Gera áudio (Piper) e vídeo (FFmpeg) para um registro pendente."""
    item_id    = item['id']
    conteudo   = item['conteudo']
    imagem_path = item.get('imagem_path') or ''

    audio_path = os.path.join(PASTA_TRABALHO, f"audio_{item_id}.wav")
    video_path = os.path.join(PASTA_TRABALHO, f"homilia_{item_id}.mp4")

    # Usa a imagem enviada pelo admin ou o fundo padrão
    fundo = imagem_path if imagem_path and os.path.exists(imagem_path) \
            else os.path.join(PASTA_TRABALHO, "fundo.jpg")

    # Marca como em processamento
    db_exec("UPDATE homilias SET status='processando' WHERE id=%s", (item_id,))

    # --- Gerar Áudio com Piper ---
    try:
        processo = subprocess.Popen(
            [PIPER_PATH, "--model", MODELO_VOZ, "--output_file", audio_path],
            stdin=subprocess.PIPE, shell=True
        )
        processo.communicate(input=conteudo.encode('utf-8'))
    except Exception as e:
        print(f"Erro no Piper: {e}")
        db_exec("UPDATE homilias SET status='erro' WHERE id=%s", (item_id,))
        return

    time.sleep(2)

    # --- Gerar Vídeo com FFmpeg ---
    if os.path.exists(audio_path) and os.path.exists(fundo):
        cmd = (
            f'"{FFMPEG_PATH}" -y -loop 1 -i "{fundo}" -i "{audio_path}" '
            f'-c:v libx264 -tune stillimage -c:a aac -b:a 192k '
            f'-pix_fmt yuv420p -shortest "{video_path}"'
        )
        subprocess.run(cmd, shell=True)

        if os.path.exists(video_path):
            url_final = f"http://{MEU_IP}:5000/download/homilia_{item_id}.mp4"
            db_exec(
                "UPDATE homilias SET status='concluido', url_video=%s WHERE id=%s",
                (url_final, item_id)
            )
            print(f"-> Concluído: {item_id}")
            return

    db_exec("UPDATE homilias SET status='erro' WHERE id=%s", (item_id,))
    print(f"-> Erro ao gerar vídeo para ID: {item_id}")

# =============================================================================
# ROBÔ PROCESSADOR (roda em thread separada)
# =============================================================================
def bot_processador():
    print("Bot iniciado. Aguardando tarefas e liturgia das 6h...")
    if not os.path.exists(PASTA_TRABALHO):
        os.makedirs(PASTA_TRABALHO)

    ultima_busca_dia = ""

    while True:
        try:
            agora   = datetime.now()
            hoje    = agora.strftime('%d/%m/%Y')
            hora    = agora.hour

            # 1. Uma vez por dia às 6h, busca a liturgia automaticamente
            if ultima_busca_dia != hoje and hora >= 6:
                t, c = buscar_liturgia_cancao_nova()
                if t and c:
                    db_exec(
                        "INSERT IGNORE INTO homilias (id, titulo, conteudo, status, url_video, imagem_path) "
                        "VALUES (%s, %s, %s, 'pendente', '', '')",
                        (int(time.time()), t, c)
                    )
                    faxina_semanal()
                ultima_busca_dia = hoje

            # 2. Processa todos os pendentes
            pendentes = db_exec(
                "SELECT id, titulo, conteudo, imagem_path FROM homilias WHERE status='pendente'",
                fetch=True
            )
            for item in (pendentes or []):
                print(f"-> Processando: {item['titulo']}")
                processar_item(item)

        except Exception as e:
            print(f"Erro no loop do bot: {e}")

        time.sleep(30)  # Verifica a cada 30 segundos

# =============================================================================
# ROTAS FLASK
# =============================================================================

@app.route('/nova-homilia', methods=['POST'])
def receber_homilia():
    """Recebe texto + imagem do painel admin e enfileira para processamento."""
    dados = request.json or {}
    titulo  = dados.get('titulo', '').strip()
    texto   = dados.get('texto', '').strip()
    imagem_b64 = dados.get('imagem', '')  # base64 da imagem (opcional)

    if not titulo or not texto:
        return jsonify({"erro": "titulo e texto são obrigatórios"}), 400

    item_id = int(time.time())

    # Salva imagem no disco se fornecida
    imagem_path = ''
    if imagem_b64 and imagem_b64.startswith('data:image'):
        try:
            import base64
            header, encoded = imagem_b64.split(',', 1)
            ext = 'jpg' if 'jpeg' in header else 'png'
            imagem_path = os.path.join(PASTA_TRABALHO, f"fundo_{item_id}.{ext}")
            with open(imagem_path, 'wb') as f:
                f.write(base64.b64decode(encoded))
        except Exception as e:
            print(f"Erro ao salvar imagem: {e}")
            imagem_path = ''

    try:
        db_exec(
            "INSERT INTO homilias (id, titulo, conteudo, status, url_video, imagem_path) "
            "VALUES (%s, %s, %s, 'pendente', '', %s)",
            (item_id, titulo, texto, imagem_path)
        )
        return jsonify({"status": "enfileirado", "id": item_id}), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/listar-videos', methods=['GET'])
def listar_videos():
    """Retorna todos os vídeos concluídos para exibição no app."""
    try:
        registros = db_exec(
            "SELECT id, titulo, url_video, criado_em FROM homilias "
            "WHERE status='concluido' ORDER BY id DESC LIMIT 50",
            fetch=True
        )
        resultado = []
        for r in (registros or []):
            resultado.append({
                "id":       r['id'],
                "titulo":   r['titulo'],
                "url":      r['url_video'],
                "data":     r['criado_em'].strftime('%d/%m/%Y %H:%M') if r['criado_em'] else '',
            })
        return jsonify({"ok": True, "videos": resultado}), 200
    except Exception as e:
        return jsonify({"ok": False, "erro": str(e)}), 500


@app.route('/status-homilia/<int:item_id>', methods=['GET'])
def status_homilia(item_id):
    """Retorna o status de processamento de uma homilia específica."""
    try:
        rows = db_exec(
            "SELECT id, titulo, status, url_video FROM homilias WHERE id=%s",
            (item_id,), fetch=True
        )
        if not rows:
            return jsonify({"ok": False, "erro": "não encontrado"}), 404
        r = rows[0]
        return jsonify({
            "ok":     True,
            "id":     r['id'],
            "titulo": r['titulo'],
            "status": r['status'],
            "url":    r['url_video'],
        }), 200
    except Exception as e:
        return jsonify({"ok": False, "erro": str(e)}), 500


@app.route('/download/<path:nome_arquivo>', methods=['GET'])
def download_video(nome_arquivo):
    """Serve os arquivos de vídeo gerados."""
    return send_from_directory(PASTA_TRABALHO, nome_arquivo, as_attachment=False)


# =============================================================================
# INICIALIZAÇÃO
# =============================================================================
if __name__ == '__main__':
    # Inicia o robô em uma thread separada
    threading.Thread(target=bot_processador, daemon=True).start()
    # Inicia o servidor Flask (acessível externamente na VPS)
    app.run(host='0.0.0.0', port=5000)