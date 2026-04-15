-- =============================================================================
-- ECC Bot – Schema MySQL
-- Execute este arquivo no MySQL antes de iniciar o automacao.py
-- =============================================================================

-- Cria o banco de dados (caso ainda não exista)
CREATE DATABASE IF NOT EXISTS paroquia_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE paroquia_db;

-- Cria o usuário exclusivo para o bot
CREATE USER IF NOT EXISTS 'bot_igreja'@'localhost' IDENTIFIED BY 'MinhaSenha123';

-- Dá permissão total apenas no banco da igreja
GRANT ALL PRIVILEGES ON paroquia_db.* TO 'bot_igreja'@'localhost';

-- Aplica as mudanças
FLUSH PRIVILEGES;

-- =============================================================================
-- Tabela principal de homilias / liturgias diárias
-- =============================================================================
CREATE TABLE IF NOT EXISTS homilias (
  id          BIGINT       NOT NULL,           -- timestamp Unix (usado como PK)
  titulo      VARCHAR(500) NOT NULL,
  conteudo    LONGTEXT     NOT NULL,
  status      VARCHAR(50)  NOT NULL DEFAULT 'pendente',
                                               -- pendente | processando | concluido | erro
  url_video   VARCHAR(1000)         DEFAULT '',
  imagem_path VARCHAR(1000)         DEFAULT '',
  criado_em   DATETIME              DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;