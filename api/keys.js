
export default async function handler(req, res) {
  const { ADMIN_PASSWORD, KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

  // 1. Verificación de Autenticación
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // 2. Conexión con Vercel KV (REST API)
  const kvFetch = async (command, args = []) => {
    const response = await fetch(`${KV_REST_API_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });
    return await response.json();
  };

  // --- MANEJO DE GET (Listar Claves) ---
  if (req.method === 'GET') {
    try {
      const result = await kvFetch('get', ['pos_licenses']);
      const licenses = result.result ? JSON.parse(result.result) : [];
      return res.status(200).json(licenses);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener licencias' });
    }
  }

  // --- MANEJO DE POST (Generar Clave) ---
  if (req.method === 'POST') {
    const { clientName } = req.body;
    if (!clientName) {
      return res.status(400).json({ error: 'Nombre del cliente requerido' });
    }

    // Algoritmo de Generación (Mismo que el original para compatibilidad)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let keyBase = '';
    for (let i = 0; i < 12; i++) {
      keyBase += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    let sum = 0;
    for (let i = 0; i < keyBase.length; i++) {
      sum += keyBase.charCodeAt(i);
    }

    let checksumStr = (sum * 88).toString(16).toUpperCase();
    checksumStr = checksumStr.padStart(4, '0').slice(-4);
    const fullKey = keyBase + checksumStr;
    const formattedKey = `${fullKey.slice(0, 4)}-${fullKey.slice(4, 8)}-${fullKey.slice(8, 12)}-${fullKey.slice(12, 16)}`;

    const newLicense = {
      key: formattedKey,
      client: clientName,
      date: new Date().toISOString()
    };

    try {
      // Guardar en KV
      const getResult = await kvFetch('get', ['pos_licenses']);
      const licenses = getResult.result ? JSON.parse(getResult.result) : [];
      licenses.push(newLicense);
      await kvFetch('set', ['pos_licenses', JSON.stringify(licenses)]);

      return res.status(200).json(newLicense);
    } catch (error) {
      return res.status(500).json({ error: 'Error al guardar licencia en la base de datos' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
