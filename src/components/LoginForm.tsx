import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { loginSchema, LoginFormData } from '../schemas/loginSchema';
import { useAuth } from '../contexts/AuthContext';
import ManipulariumLogo from '../assets/ManipulariumLogo.png';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, loginError, clearLoginError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    clearLoginError(); // Clear any previous error

    const success = await login(data.username, data.password);

    if (success) {
      navigate('/dashboard');
    }
    // Error handling is now done in the AuthContext
  };

  try {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-6">
            <img 
              src={ManipulariumLogo} 
              alt="Manipularium Logo" 
              className="h-24 w-24 mx-auto drop-shadow-lg"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-100">
            Manipularium
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Conferência Bancária - Acesso Restrito
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 px-6 py-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Username Field */}
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Nome de usuário
              </label>
              <input
                {...register('username')}
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                aria-describedby={errors.username ? 'username-error' : undefined}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-gray-700 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                  errors.username ? 'border-red-400' : 'border-gray-600'
                }`}
                placeholder="Digite seu nome de usuário"
              />
              {errors.username && (
                <p id="username-error" className="mt-1 text-sm text-red-400" role="alert">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Senha
              </label>
              <input
                {...register('password')}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-gray-700 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                  errors.password ? 'border-red-400' : 'border-gray-600'
                }`}
                placeholder="Digite sua senha"
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-400" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Login Error */}
            {loginError && (
              <div className="bg-red-900/20 border border-red-400 rounded-md p-3">
                <p className="text-sm text-red-400" role="alert">
                  {loginError}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <svg 
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
    );
  } catch (error) {
    console.error('LoginForm render error:', error);
    return <div className="min-h-screen bg-red-500 flex items-center justify-center text-white">Error rendering LoginForm: {String(error)}</div>;
  }
};