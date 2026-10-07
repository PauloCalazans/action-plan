/**
 * Operações internas do 002, sem exposição por protocolo algum (CA11: "operação interna do serviço,
 * sem operação pública"). A operação exposta a usuários é do intent 003.
 */
@protocol: 'none'
service TratativaInternaService {
  /** R12: recalcula a Data prevista desde a criação original e registra histórico. */
  action alterarCriticidade(codigo : UUID, criticidade : String(10), autor : String(256), tipoAutor : String(20));
}
