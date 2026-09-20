import { createContext } from 'react';

// Using `any` default to avoid require-cycle uninitialized issues and simplify useContext
export const AuthContext = createContext<any>(null);
export const CartContext = createContext<any>(null);
