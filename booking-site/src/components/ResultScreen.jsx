import { Link } from 'react-router-dom';

export default function ResultScreen({ success, service }) {
  return (
    <div className="page">
      <div className="result-card">
        <h1>{success ? 'Pedido enviado!' : 'Algo correu mal'}</h1>
        <p>
          {success
            ? `O seu pedido de marcação para "${service?.name}" foi enviado. Vai receber a confirmação por WhatsApp assim que for aceite.`
            : 'Não foi possível concluir o seu pedido.'}
        </p>
        <Link to="/" className="back-link">&larr; Voltar aos serviços</Link>
      </div>
    </div>
  );
}
