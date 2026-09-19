CREATE DATABASE IF NOT EXISTS sistema_acessibilidade;

USE sistema_acessibilidade;

CREATE TABLE IF NOT EXISTS usuarios (

    id INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(100) NOT NULL,

    email VARCHAR(100) UNIQUE NOT NULL,

    senha VARCHAR(100) NOT NULL,

    estilo_usuario VARCHAR(50)

);

CREATE TABLE IF NOT EXISTS tarefas (

    id INT AUTO_INCREMENT PRIMARY KEY,

    usuario_id INT,

    titulo VARCHAR(255),

    descricao TEXT,

    concluida BOOLEAN DEFAULT FALSE,

    passos_ia TEXT,

    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)

);