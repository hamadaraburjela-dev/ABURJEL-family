import React from 'react';
import MartyrForm from '../components/forms/MartyrForm';

const MartyrRegistration: React.FC = () => {
    const handleSubmit = (data: any) => {
        // Handle form submission logic here
        console.log('Martyr registration data:', data);
    };

    return (
        <div>
            <h1>تسجيل الشهداء</h1>
            <MartyrForm onSubmit={handleSubmit} />
        </div>
    );
};

export default MartyrRegistration;