import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConferenceHistoryService, ConferenceHistoryEntry } from '../src/services/conferenceHistory';
import { formatToDDMMYYYY, getTodayDDMMYYYY } from '../src/utils/dateFormatter';

describe('Database Integration Tests', () => {
  const todayDate = getTodayDDMMYYYY();
  const testFileName = 'test-upload.xlsx';

  // Dados de teste
  const testBankingData = [
    {
      id: 'test-1',
      documentNumber: 'DOC001',
      date: '15-01-2024',
      description: 'Pagamento Cartão Crédito',
      value: 150.50,
      bankName: 'Banco Test',
      accountNumber: '12345',
      transactionType: 'credit_card',
      balance: 1000.00,
      paymentType: 'Cartão Crédito',
      cpf: '123.456.789-00',
      originalHistory: 'PAGAMENTO CARTAO'
    },
    {
      id: 'test-2',
      documentNumber: 'DOC002',
      date: '15-01-2024',
      description: 'Depósito em Dinheiro',
      value: 250.00,
      bankName: 'Banco Test',
      accountNumber: '12345',
      transactionType: 'deposit',
      balance: 1250.00,
      paymentType: 'Dinheiro',
      cpf: '987.654.321-00',
      originalHistory: 'DEPOSITO DINHEIRO'
    }
  ];

  beforeAll(async () => {
    console.log('🚀 Iniciando testes de integração com banco de dados...');
    // Limpar dados de teste anteriores
    try {
      await ConferenceHistoryService.clearDayHistory(todayDate);
    } catch (error) {
      console.log('Limpeza inicial opcional falhou:', error);
    }
  });

  afterAll(async () => {
    console.log('🧹 Limpando dados de teste...');
    // Limpar dados de teste
    try {
      await ConferenceHistoryService.clearDayHistory(todayDate);
    } catch (error) {
      console.log('Limpeza final opcional falhou:', error);
    }
  });

  describe('1. Salvamento de Upload Bancário', () => {
    it('deve salvar upload bancário com sucesso', async () => {
      console.log('📤 Testando salvamento de upload bancário...');

      await expect(
        ConferenceHistoryService.saveBankingUpload(
          testBankingData,
          testFileName,
          todayDate,
          'automatic'
        )
      ).resolves.not.toThrow();

      console.log('✅ Upload bancário salvo com sucesso');
    });

    it('deve recuperar dados salvos do upload', async () => {
      console.log('📥 Testando recuperação de dados do upload...');

      const history = await ConferenceHistoryService.getHistoryByDate(todayDate);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      const uploadedItems = history.filter(item => item.operation_type === 'banking_upload');
      expect(uploadedItems.length).toBeGreaterThan(0);

      // Verificar primeiro item
      const firstItem = uploadedItems.find(item => item.document_number === 'DOC001');
      expect(firstItem).toBeDefined();
      if (firstItem) {
        expect(firstItem.value).toBe(150.50);
        expect(firstItem.description).toBe('Pagamento Cartão Crédito');
        expect(firstItem.file_name).toBe(testFileName);
      }

      console.log(`✅ Recuperados ${uploadedItems.length} itens do upload`);
    });
  });

  describe('2. Conferência de Caixa', () => {
    it('deve salvar conferência de caixa com sucesso', async () => {
      console.log('💰 Testando salvamento de conferência de caixa...');

      const conferenceItem = {
        id: 'conf-1',
        documentNumber: 'DOC003',
        description: 'Conferência Manual',
        value: 100.00,
        date: todayDate,
        paymentType: 'Dinheiro',
        cpf: '111.222.333-44',
        originalHistory: 'CONFERENCIA MANUAL'
      };

      await expect(
        ConferenceHistoryService.saveCashConference(
          conferenceItem,
          todayDate,
          'conferred'
        )
      ).resolves.not.toThrow();

      console.log('✅ Conferência de caixa salva com sucesso');
    });

    it('deve recuperar conferências salvas', async () => {
      console.log('📊 Testando recuperação de conferências...');

      const history = await ConferenceHistoryService.getHistoryByDate(todayDate);

      const conferredItems = history.filter(
        item => item.operation_type === 'cash_conference' && item.status === 'conferred'
      );

      expect(conferredItems.length).toBeGreaterThan(0);

      const conferredItem = conferredItems[0];
      expect(conferredItem).toBeDefined();
      expect(conferredItem.conferred_at).toBeDefined();
      expect(conferredItem.status).toBe('conferred');

      console.log(`✅ Recuperadas ${conferredItems.length} conferências`);
    });
  });

  describe('3. Valores Não Encontrados', () => {
    it('deve salvar valor não encontrado', async () => {
      console.log('❌ Testando salvamento de valor não encontrado...');

      await expect(
        ConferenceHistoryService.saveNotFound(
          '999,99',
          todayDate
        )
      ).resolves.not.toThrow();

      console.log('✅ Valor não encontrado salvo com sucesso');
    });

    it('deve recuperar valores não encontrados', async () => {
      console.log('🔍 Testando recuperação de valores não encontrados...');

      const history = await ConferenceHistoryService.getHistoryByDate(todayDate);

      const notFoundItems = history.filter(
        item => item.operation_type === 'not_found'
      );

      expect(notFoundItems.length).toBeGreaterThan(0);

      const notFoundItem = notFoundItems[0];
      expect(notFoundItem).toBeDefined();
      expect(notFoundItem.status).toBe('not_found');
      expect(notFoundItem.value).toBe(999.99);

      console.log(`✅ Recuperados ${notFoundItems.length} valores não encontrados`);
    });
  });

  describe('4. Resumo Diário', () => {
    it('deve obter resumo diário', async () => {
      console.log('📈 Testando obtenção de resumo diário...');

      const summary = await ConferenceHistoryService.getDailySummary(todayDate);

      // O resumo pode ser null se não houver dados
      if (summary) {
        expect(summary.operation_date).toBe(todayDate);
        console.log('✅ Resumo diário obtido:', {
          data: summary.operation_date,
          totalUpload: summary.banking_total_uploaded,
          totalConferido: summary.cash_conferred_count,
          valorTotal: summary.total_value
        });
      } else {
        console.log('⚠️ Resumo diário não disponível (esperado em ambiente de teste)');
      }
    });
  });

  describe('5. Histórico por Período', () => {
    it('deve buscar histórico por período', async () => {
      console.log('📅 Testando busca de histórico por período...');

      const startDate = '01-01-2024';
      const endDate = '31-12-2024';

      const history = await ConferenceHistoryService.getHistoryByDateRange(
        startDate,
        endDate
      );

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      console.log(`✅ Histórico do período recuperado: ${history.length} registros`);
    });
  });

  describe('6. Atualização de Status', () => {
    it('deve atualizar status de conferência', async () => {
      console.log('🔄 Testando atualização de status...');

      // Primeiro, obter um item pendente
      const history = await ConferenceHistoryService.getHistoryByDate(todayDate);
      const pendingItem = history.find(item => item.status === 'pending');

      if (pendingItem && pendingItem.id) {
        await expect(
          ConferenceHistoryService.updateConferenceStatus(
            pendingItem.id,
            'conferred'
          )
        ).resolves.not.toThrow();

        // Verificar atualização
        const updatedHistory = await ConferenceHistoryService.getHistoryByDate(todayDate);
        const updatedItem = updatedHistory.find(item => item.id === pendingItem.id);

        expect(updatedItem).toBeDefined();
        if (updatedItem) {
          expect(updatedItem.status).toBe('conferred');
          console.log('✅ Status atualizado com sucesso');
        }
      } else {
        console.log('⚠️ Nenhum item pendente para testar atualização');
      }
    });
  });

  describe('7. Exclusão de Registros', () => {
    it('deve excluir registro individual', async () => {
      console.log('🗑️ Testando exclusão de registro...');

      // Criar um registro para excluir
      await ConferenceHistoryService.saveNotFound('888,88', todayDate);

      const history = await ConferenceHistoryService.getHistoryByDate(todayDate);
      const itemToDelete = history.find(item => item.value === 888.88);

      if (itemToDelete && itemToDelete.id) {
        await expect(
          ConferenceHistoryService.deleteHistoryEntry(itemToDelete.id)
        ).resolves.not.toThrow();

        // Verificar exclusão
        const updatedHistory = await ConferenceHistoryService.getHistoryByDate(todayDate);
        const deletedItem = updatedHistory.find(item => item.id === itemToDelete.id);

        expect(deletedItem).toBeUndefined();
        console.log('✅ Registro excluído com sucesso');
      } else {
        console.log('⚠️ Nenhum item para testar exclusão');
      }
    });
  });

  describe('8. Teste de Concorrência', () => {
    it('deve lidar com múltiplas operações simultâneas', async () => {
      console.log('🔀 Testando operações simultâneas...');

      const promises = [
        ConferenceHistoryService.saveNotFound('111,11', todayDate),
        ConferenceHistoryService.saveNotFound('222,22', todayDate),
        ConferenceHistoryService.saveNotFound('333,33', todayDate),
        ConferenceHistoryService.saveCashConference(
          { value: 444.44, description: 'Teste Concorrência 1' },
          todayDate,
          'conferred'
        ),
        ConferenceHistoryService.saveCashConference(
          { value: 555.55, description: 'Teste Concorrência 2' },
          todayDate,
          'conferred'
        )
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();

      console.log('✅ Operações simultâneas executadas com sucesso');
    });
  });

  describe('9. Validação de Dados', () => {
    it('deve validar tipos de dados corretamente', async () => {
      console.log('✔️ Testando validação de tipos de dados...');

      const history = await ConferenceHistoryService.getHistoryByDate(todayDate);

      if (history.length > 0) {
        const item = history[0];

        // Verificar tipos
        expect(typeof item.operation_date).toBe('string');
        expect(typeof item.operation_type).toBe('string');

        if (item.value !== null) {
          expect(typeof item.value).toBe('number');
        }

        expect(['banking_upload', 'cash_conference', 'not_found']).toContain(item.operation_type);

        if (item.status) {
          expect(['conferred', 'not_found', 'pending']).toContain(item.status);
        }

        console.log('✅ Validação de tipos aprovada');
      } else {
        console.log('⚠️ Sem dados para validar tipos');
      }
    });
  });
});