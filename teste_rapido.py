import requests
from bs4 import BeautifulSoup
import subprocess
import os

# --- CAMINHOS (Verifique se estão corretos na sua VPS) ---
PIPER_PATH = "C:\\piper\\piper.exe"
MODELO_VOZ = "C:\\piper\\voz\\pt_BR-faber-medium.onnx"
AUDIO_TESTE = "teste_liturgia.wav"

def buscar_evangelho():
    print("-> Acedendo à Canção Nova...")
    url = "https://liturgia.cancaonova.com/pb/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Tenta o ID liturgia-4 (Evangelho)
        conteudo = soup.find("div", {"id": "liturgia-4"})
        
        if not conteudo:
            # Busca alternativa por título
            for h2 in soup.find_all("h2"):
                if "Evangelho" in h2.get_text():
                    conteudo = h2.find_parent()
                    break

        if conteudo:
            # Limpa títulos e referências para a voz ficar natural
            for tag in conteudo(['h2', 'span', 'strong']):
                tag.decompose()
            
            texto_final = conteudo.get_text(separator=" ", strip=True)
            if len(texto_final) > 50:
                return texto_final
            
    except Exception as e:
        print(f"Erro na conexão: {e}")
    return None

def gerar_audio(texto_para_ler):
    print("-> Gerando áudio com Piper... (Aguarde)")
    try:
        # Comando para o Piper
        comando = [PIPER_PATH, "--model", MODELO_VOZ, "--output_file", AUDIO_TESTE]
        
        # Executa e envia o texto via stdin
        processo = subprocess.Popen(comando, stdin=subprocess.PIPE, shell=True)
        processo.communicate(input=texto_para_ler.encode('utf-8'))
        
        if os.path.exists(AUDIO_TESTE):
            print(f"-> SUCESSO! O arquivo '{AUDIO_TESTE}' foi criado.")
            print(f"-> Local: {os.path.abspath(AUDIO_TESTE)}")
        else:
            print("-> ERRO: O Piper rodou, mas o arquivo não apareceu.")
            
    except Exception as e:
        print(f"-> Erro ao rodar o Piper: {e}")

# --- EXECUÇÃO DO TESTE ---
if __name__ == "__main__":
    texto_extraido = buscar_evangelho()
    
    if texto_extraido:
        print(f"Texto extraído com sucesso! (Tamanho: {len(texto_extraido)} caracteres)")
        print("-" * 30)
        print(texto_extraido[:100] + "...") # Mostra só o começo no terminal
        print("-" * 30)
        
        # CHAMA A FUNÇÃO QUE ESTAVA FALTANDO
        gerar_audio(texto_extraido)
    else:
        print("Erro: Não foi possível extrair o texto do Evangelho.")