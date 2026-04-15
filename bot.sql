-- Cria o usuário exclusivo para o bot
CREATE USER IF NOT EXISTS 'bot_igreja'@'localhost' IDENTIFIED BY 'MinhaSenha123';

-- Dá permissão total apenas no banco da igreja
GRANT ALL PRIVILEGES ON paroquia_db.* TO 'bot_igreja'@'localhost';

-- Aplica as mudanças
FLUSH PRIVILEGES;