import { HttpException, HttpStatus } from '@nestjs/common';

interface DomainErrorOptions {
  code: string;
  detail: string;
  status?: HttpStatus;
  type?: string;
  title?: string;
}

export class DomainHttpError extends HttpException {
  constructor(options: DomainErrorOptions) {
    super(
      {
        type: options.type ?? `https://docs.sistema-licencas.dev/problems/${options.code}`,
        title: options.title ?? options.code,
        code: options.code,
        message: options.detail
      },
      options.status ?? HttpStatus.BAD_REQUEST
    );
  }
}
