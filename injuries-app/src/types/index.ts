export interface Injury {
    id: string;
    name: string;
    description: string;
    date: string;
    severity: 'minor' | 'moderate' | 'severe';
}

export interface InjuryFormValues {
    name: string;
    description: string;
    date: string;
    severity: 'minor' | 'moderate' | 'severe';
}

export interface InjuriesState {
    injuries: Injury[];
    loading: boolean;
    error: string | null;
}

export interface Martyr {
    id: string;
    name: string;
    dateOfDeath: string;
    cause: string;
}

export interface MartyrFormValues {
    name: string;
    dateOfDeath: string;
    cause: string;
}