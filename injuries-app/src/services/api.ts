import axios from 'axios';

const API_BASE_URL = 'https://your-api-url.com/api'; // Replace with your actual API base URL

export const registerInjury = async (injuryData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/injuries`, injuryData);
        return response.data;
    } catch (error) {
        throw new Error('Error registering injury: ' + error.message);
    }
};

export const fetchInjuries = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/injuries`);
        return response.data;
    } catch (error) {
        throw new Error('Error fetching injuries: ' + error.message);
    }
};

export const deleteInjury = async (injuryId) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/injuries/${injuryId}`);
        return response.data;
    } catch (error) {
        throw new Error('Error deleting injury: ' + error.message);
    }
};