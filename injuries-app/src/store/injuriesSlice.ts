import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Injury {
    id: string;
    name: string;
    description: string;
    date: string;
}

interface InjuriesState {
    injuries: Injury[];
}

const initialState: InjuriesState = {
    injuries: [],
};

const injuriesSlice = createSlice({
    name: 'injuries',
    initialState,
    reducers: {
        addInjury: (state, action: PayloadAction<Injury>) => {
            state.injuries.push(action.payload);
        },
        removeInjury: (state, action: PayloadAction<string>) => {
            state.injuries = state.injuries.filter(injury => injury.id !== action.payload);
        },
        updateInjury: (state, action: PayloadAction<Injury>) => {
            const index = state.injuries.findIndex(injury => injury.id === action.payload.id);
            if (index !== -1) {
                state.injuries[index] = action.payload;
            }
        },
    },
});

export const { addInjury, removeInjury, updateInjury } = injuriesSlice.actions;

export default injuriesSlice.reducer;