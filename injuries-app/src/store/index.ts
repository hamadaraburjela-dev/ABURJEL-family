import { configureStore } from '@reduxjs/toolkit';
import injuriesReducer from './injuriesSlice';

const store = configureStore({
  reducer: {
    injuries: injuriesReducer,
  },
});

export default store;