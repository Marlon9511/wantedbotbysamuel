import { MessageMedia } from 'whatsapp-web.js';
import sharp from 'sharp';
import fs from 'fs';

export async function handleSticker(message, client) {
    try {
        if (!message.hasMedia) return;

        const media = await message.downloadMedia();

        if (!media.mimetype.startsWith('image')) return;

        const buffer = Buffer.from(media.data, 'base64');
        const filePath = './temp.webp';

        // Bild → Sticker konvertieren
        await sharp(buffer)
            .resize(512, 512, { fit: 'contain' })
            .webp()
            .toFile(filePath);

        const sticker = MessageMedia.fromFilePath(filePath);

        await client.sendMessage(message.from, sticker, {
            sendMediaAsSticker: true
        });

        fs.unlinkSync(filePath);

    } catch (err) {
        console.error('Sticker Fehler:', err);
    }
}