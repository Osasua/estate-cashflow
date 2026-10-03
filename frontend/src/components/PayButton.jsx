import { PaystackButton } from 'react-paystack';

export default function PayButton({ amountLeft, email, contributionId, userId, publicKey, onSuccess, onClose }) {
  const componentProps = {
    email: email,
    amount: amountLeft * 100,
    publicKey: publicKey,
    text: `Pay ₦${amountLeft.toLocaleString()}`,
    onSuccess: (reference) => {
      console.log('✅ Paystack Success Callback Fired!', reference);
      onSuccess(reference);
    },
    onClose: () => {
      console.log('❌ Paystack Popup Closed');
      onClose();
    },
    metadata: {
      contribution_id: contributionId,
      user_id: userId,
      custom_fields: [
        {
          display_name: "Contribution ID",
          variable_name: "contribution_id",
          value: contributionId
        }
      ]
    }
  };

  return (
    <PaystackButton
      {...componentProps}
      className="paystack-btn"
      style={{
        padding: '6px 12px',
        background: '#4f46e5',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 'bold'
      }}
    />
  );
}