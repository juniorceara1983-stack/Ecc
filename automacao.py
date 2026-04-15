import time
import threading
import subprocess
import os
import requests
import gspread
from datetime import datetime
from bs4 import BeautifulSoup
from oauth2client.service_account import ServiceAccountCredentials
from flask import Flask, request, jsonify

app = Flask(__name__)

# --- CONFIGURAÇÃO DE CAMINHOS ---
FFMPEG_PATH = "C:\\ffmpeg\\bin\\ffmpeg.exe"
PIPER_PATH = "C:\\piper\\piper.exe"
MODELO_VOZ = "C:\\piper\\voz\\pt_BR-faber-medium.onnx"
PASTA_TRABALHO = "C:\\homilias"
FUNDO_VIDEO = os.path.join(PASTA_TRABALHO, "fundo.jpg")
ARQUIVO_CREDENCIAIS = "credenciais.json"
NOME_PLANILHA = "NOME_DA_SUA_PLANILHA" # <-- ALTERE AQUI
NOME_ABA = "Liturgia_Diaria"

# --- CONFIGURAÇÃO GOOGLE SHEETS ---
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
creds = ServiceAccountCredentials.from_json_keyfile_name(ARQUIVO_CREDENCIAIS, scope)
client = gspread.authorize(creds)
sheet = client.open(NOME_PLANILHA).worksheet(NOME_ABA)

# --- FUNÇÃO: BUSCAR LITURGIA CANÇÃO NOVA ---
def buscar_liturgia_cancao_nova():
    print("-> Buscando liturgia na Canção Nova...")
    url = "https://liturgia.cancaonova.com/pb/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers)
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, 'html.parser')
        
        titulo = f"Evangelho {datetime.now().strftime('%d/%m/%Y')}"
        conteudo_div = soup.find("div", {"class": "content-liturgia"})
        
        if conteudo_div:
            # Remove scripts ou elementos desnecessários se houver
            texto = conteudo_div.get_text(separator="\n", strip=True)
            return titulo, texto
    except Exception as e:
        print(f"Erro ao buscar liturgia: {e}")
    return None, None

# --- FUNÇÃO: FAXINA SEMANAL ---
def faxina_semanal():
    print("-> Executando faxina semanal...")
    try:
        registros = sheet.get_all_records()
        limite_tempo = time.time() - (7 * 24 * 60 * 60)
        
        # Deletar do fim para o começo para não errar o índice das linhas
        for i in range(len(registros) + 1, 1, -1):
            row = sheet.row_values(i)
            if not row: continue
            
            id_timestamp = float(row[0]) # Coluna A (id)
            status = row[3] # Coluna D (status)
            
            if id_timestamp < limite_tempo and status == 'concluido':
                # Opcional: deletar arquivos físicos
                arq_audio = os.path.join(PASTA_TRABALHO, f"audio_{int(id_timestamp)}.wav")
                arq_video = os.path.join(PASTA_TRABALHO, f"homilia_{int(id_timestamp)}.mp4")
                for f in [arq_audio, arq_video]:
                    if os.path.exists(f): os.remove(f)
                
                sheet.delete_rows(i)
                print(f"-> Removido registro antigo ID: {id_timestamp}")
    except Exception as e:
        print(f"Erro na faxina: {e}")

# --- ROTA FLASK (Para envios manuais do PWA) ---
@app.route('/nova-homilia', methods=['POST'])
def receber_homilia():
    dados = request.json
    try:
        sheet.append_row([
            int(time.time()), 
            dados['titulo'], 
            dados['texto'], 
            'pendente', 
            ''
        ])
        return jsonify({"status": "sucesso"}), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# --- ROBÔ PROCESSADOR ---
def bot_processador():
    print("Bot iniciado. Monitorando Planilha e Canção Nova...")
    if not os.path.exists(PASTA_TRABALHO): os.makedirs(PASTA_TRABALHO)

    ultima_busca_dia = ""

    while True:
        try:
            hoje = datetime.now().strftime('%d/%m/%Y')
            
            # 1. Uma vez por dia, busca a liturgia automática
            if ultima_busca_dia != hoje:
                t, c = buscar_liturgia_cancao_nova()
                if t and c:
                    sheet.append_row([int(time.time()), t, c, 'pendente', ''])
                    faxina_semanal()
                    ultima_busca_dia = hoje

            # 2. Verifica o que está pendente na planilha
            registros = sheet.get_all_records()
            for i, item in enumerate(registros, start=2):
                if item['status'] == 'pendente':
                    item_id = item['id']
                    print(f"-> Processando: {item['titulo']}")
                    
                    sheet.update_cell(i, 4, 'processando')
                    
                    audio_path = os.path.join(PASTA_TRABALHO, f"audio_{item_id}.wav")
                    video_path = os.path.join(PASTA_TRABALHO, f"homilia_{item_id}.mp4")
                    
                    # Gerar Áudio (Piper)
                    processo = subprocess.Popen(
                        [PIPER_PATH, "--model", MODELO_VOZ, "--output_file", audio_path],
                        stdin=subprocess.PIPE, shell=True
                    )
                    processo.communicate(input=item['conteudo'].encode('utf-8'))
                    
                    time.sleep(2)
                    
                    # Gerar Vídeo (FFmpeg)
                    if os.path.exists(audio_path):
                        comando_ffmpeg = (f'"{FFMPEG_PATH}" -loop 1 -i "{FUNDO_VIDEO}" -i "{audio_path}" '
                                          f'-c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "{video_path}"')
                        subprocess.run(comando_ffmpeg, shell=True)
                        
                        # Atualiza planilha com link e concluído
                        # Substitua SEU_IP pelo IP da sua VPS
                        url_final = f"http://SEU_IP:5000/download/homilia_{item_id}.mp4"
                        sheet.update_cell(i, 4, 'concluido')
                        sheet.update_cell(i, 5, url_final)
                        print(f"-> Concluído: {item_id}")
                    else:
                        sheet.update_cell(i, 4, 'erro')

        except Exception as e:
            print(f"Erro no loop do bot: {e}")
        
        time.sleep(30) # Verifica a cada 30 segundos

if __name__ == '__main__':
    # Inicia o robô em uma thread separada
    threading.Thread(target=bot_processador, daemon=True).start()
    # Inicia o servidor Flask
    app.run(host='0.0.0.0', port=5000)