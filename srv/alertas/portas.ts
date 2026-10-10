export interface EmailPort {
  enviarEmail(destinatario: string, assunto: string, corpo: string): Promise<void>;
}

export interface TeamsPort {
  enviarMensagem(destinatarioTeamsId: string, titulo: string, corpo: string): Promise<void>;
}

export interface DiretorioPessoasPort {
  resolverPessoa(matricula: string): Promise<{ email: string; teamsId: string } | null>;
}
