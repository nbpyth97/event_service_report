import { useState } from 'react';
import { submitBooking } from '../lib/api';

export default function BookingForm({ tenant, gender, serviceSlug, date, start, onResult }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitBooking({ tenant, gender, service: serviceSlug, date, start, name, phone });
      onResult({ ok: true });
    } catch (err) {
      onResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="name">Nome</label>
        <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor="phone">Telemóvel</label>
        <input
          id="phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="912 345 678"
        />
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'A enviar…' : 'Pedir marcação'}
      </button>
      <p className="form-note">O seu pedido fica pendente até ser confirmado. Vai receber a resposta por WhatsApp.</p>
    </form>
  );
}
