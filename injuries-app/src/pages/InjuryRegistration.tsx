import React from 'react';
import InjuryForm from '../components/forms/InjuryForm';
import DashboardLayout from '../components/layout/DashboardLayout';

const InjuryRegistration: React.FC = () => {
    const handleSubmit = (data: any) => {
        // Handle form submission logic here
        console.log('Injury data submitted:', data);
    };

    return (
        <DashboardLayout>
            <h1>تسجيل الإصابات</h1>
            <InjuryForm onSubmit={handleSubmit} />
        </DashboardLayout>
    );
};

export default InjuryRegistration;