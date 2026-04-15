class MailDecorator {
    static decorate(content) {
        // Identité fixe de NJILA
        const brand = {
            name: 'NJILA',
            color: '#008751', // Le vert de ton logo
            logo: 'https://res.cloudinary.com/dknoyhupu/image/upload/f_auto,q_auto/WhatsApp_Image_2026-04-07_at_11.23.22_oojftp' // Remplace par ton lien réel
        };
        
        return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; padding: 40px 20px;">
            <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                
                <div style="background-color: #ffffff; padding: 25px; text-align: center; border-bottom: 4px solid ${brand.color};">
                    <img src="${brand.logo}" alt="NJILA" style="height: 100px; width: auto;">
                </div>
                
                <div style="padding: 40px 30px; color: #333; line-height: 1.8; font-size: 16px;">
                    ${content}
                </div>

                <div style="background-color: #1a1a1a; color: #ffffff; padding: 25px; text-align: center; font-size: 12px;">
                    <p style="margin: 0; font-weight: bold; letter-spacing: 1px;">NJILA</p>
                    <p style="margin: 5px 0; color: #888;">Votre voyage commence ici !!!</p>
                    <div style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px; color: #555;">
                        Ceci est un message de la plateforme NJILA.
                    </div>
                </div>
            </div>
        </div>`;
    }
}

module.exports = MailDecorator;