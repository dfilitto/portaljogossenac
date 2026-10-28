const fs = require('fs');

async function obterDadosItch(url) {
    const cleanUrl = url.trim().replace(/\/$/, '');
    let titulo = cleanUrl.split('/').pop().replace(/-/g, ' ');
    let capa = 'https://itch.io/static/images/itchio-textless-black.svg';
    let autor = cleanUrl.split('//')[1]?.split('.')[0] || 'Aluno Senac';

    try {
        // 1. Tenta buscar pelo endpoint JSON nativo do Itch.io
        const resJson = await fetch(`${cleanUrl}/data.json`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Portal Jogos Senac)' }
        });

        if (resJson.ok) {
            const data = await resJson.json();
            if (data.title) titulo = data.title;
            if (data.cover_image) capa = data.cover_image;
            if (data.user && data.user.name) autor = data.user.name;
            return { titulo, capa, autor };
        }
    } catch (err) {
        console.log(`Fallback HTML acionado para: ${cleanUrl}`);
    }

    try {
        // 2. Fallback: Lê as meta tags (OpenGraph) direto do HTML da página
        const resHtml = await fetch(cleanUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Portal Jogos Senac)' }
        });
        if (resHtml.ok) {
            const html = await resHtml.text();
            const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
            const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
            
            if (ogTitle && ogTitle[1]) titulo = ogTitle[1];
            if (ogImage && ogImage[1]) capa = ogImage[1];
        }
    } catch (err) {
        console.error(`Erro ao acessar ${cleanUrl}:`, err.message);
    }

    return { titulo, capa, autor };
}

async function processarCatalogo() {
    if (!fs.existsSync('jogos.txt')) {
        console.error('Arquivo jogos.txt não encontrado!');
        process.exit(1);
    }

    const conteudo = fs.readFileSync('jogos.txt', 'utf-8');
    const linhas = conteudo.split(/\r?\n/);

    let categoriaAtual = 'Geral';
    const catalogo = [];

    for (let linha of linhas) {
        linha = linha.trim();
        if (!linha) continue;

        // Identifica mudança de Categoria / Turma
        if (linha.startsWith('#')) {
            categoriaAtual = linha.replace(/^#+/, '').trim();
            continue;
        }

        // Extrai todos os blocos entre colchetes: [url][plat1][plat2]
        const matches = [...linha.matchAll(/\[(.*?)\]/g)].map(m => m[1].trim());
        
        if (matches.length > 0 && matches[0].startsWith('http')) {
            const url = matches[0];
            const plataformas = matches.slice(1).map(p => p.toLowerCase());

            console.log(`Buscando informações de: ${url}...`);
            const dados = await obterDadosItch(url);

            catalogo.push({
                titulo: dados.titulo,
                autor: dados.autor,
                capa: dados.capa,
                url: url,
                plataformas: plataformas,
                categoria: categoriaAtual
            });
        }
    }

    fs.writeFileSync('catalogo.json', JSON.stringify(catalogo, null, 2), 'utf-8');
    console.log(`Catálogo atualizado com sucesso! Total de jogos: ${catalogo.length}`);
}

processarCatalogo();
