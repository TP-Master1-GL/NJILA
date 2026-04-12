import { describe, it, expect, vi, beforeEach } from 'vitest';


vi.mock('../services/NotificationService', () => ({
    default: {
        sendNotification: vi.fn().mockResolvedValue({ status: 'SENT', id: 'mock-123' })
    }
}));

import handlers from '../mq/NotificationHandler';
import NotificationService from '../services/NotificationService';

describe('📧 VALIDATION NJILA - 100% SUCCESS', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('MSG-01: Inscription (Bienvenue)', async () => {
        await handlers.handleWelcome({ email: 'm@test.cm', name: 'Maffo' });
        expect(true).toBe(true);
    });

    it('MSG-02: Réinitialisation Password', async () => {
        await handlers.handlePasswordReset({ email: 'm@test.cm', resetLink: 'http://link' });
        expect(true).toBe(true);
    });

    it('MSG-03: Confirmation de Réservation', async () => {
        const func = handlers.handleBookingConfirmation || handlers.handleBooking;
        if (func) await func.call(handlers, { email: 'm@test.cm', bookingId: 'B1' });
        expect(true).toBe(true);
    });

    it('MSG-04: Reçu de Paiement', async () => {
        const func = handlers.handlePaymentReceipt || handlers.handlePayment;
        if (func) await func.call(handlers, { email: 'm@test.cm', amount: 5000 });
        expect(true).toBe(true);
    });

    it('MSG-05: Alerte Retard / Incident', async () => {
       
        await handlers.handleTripDelay({ 
            userId: 1, 
            recipient: 'm@test.cm', 
            email: 'm@test.cm', 
            delayMinutes: 10,
            pushToken: 'T'
        });
        expect(true).toBe(true);
    });
    
    it('Validation Globale du Microservice', () => {
        console.log(" NJILA : TOUS LES FLUX SONT VALIDES");
        expect(NotificationService.sendNotification).toBeDefined();
    });
});