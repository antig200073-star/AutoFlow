"""Validação antes de qualquer gravação; números de documento permanecem texto."""
import re
from decimal import Decimal, InvalidOperation


def email_value(value):
    email = str(value or '').strip().lower()
    if len(email) > 254 or re.search(r'[\x00-\x1f\x7f]', email) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ValueError('Informe um e-mail válido, como nome@exemplo.com.')
    return email


def text_value(value, label, maximum, minimum=0, multiline=False):
    text = str(value or '').strip()
    if not multiline:
        text = re.sub(r'\s+', ' ', text)
    if not minimum <= len(text) <= maximum or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', text):
        raise ValueError(f'{label}: use de {minimum} a {maximum} caracteres.')
    return text


def normalize_cnpj(value):
    source = str(value or '')
    return re.sub(r'[./\s-]', '', source).upper() if re.fullmatch(r'[A-Za-z0-9./\s-]*', source) else source


def valid_cnpj(value):
    cnpj = normalize_cnpj(value)
    if not re.fullmatch(r'[A-Z0-9]{12}[0-9]{2}', cnpj) or len(set(cnpj)) == 1:
        return False
    # Receita Federal: ASCII - 48 também para as letras das primeiras 12 posições.
    def digit(part):
        total = sum((ord(char) - 48) * (2 + i % 8) for i, char in enumerate(reversed(part)))
        remainder = total % 11
        return str(0 if remainder < 2 else 11 - remainder)
    first = digit(cnpj[:12])
    return cnpj == cnpj[:12] + first + digit(cnpj[:12] + first)


def cnpj_value(value):
    cnpj = normalize_cnpj(value)
    # A autorização do modo de teste continua obrigatória na Edge Function.
    demo = bool(re.fullmatch(r'0{12}[0-9]{2}', cnpj)) and cnpj[-2:] != '00'
    if not demo and not valid_cnpj(cnpj):
        raise ValueError('CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.')
    return cnpj


def format_cnpj(value):
    cnpj = normalize_cnpj(value)
    if not re.fullmatch(r'[A-Z0-9]{0,14}', cnpj):
        return str(value)
    result = ''
    for i, char in enumerate(cnpj):
        result += {2: '.', 5: '.', 8: '/', 12: '-'}.get(i, '') + char
    return result


def format_plate(value):
    if not re.fullmatch(r'[A-Za-z0-9 -]*', str(value or '')):
        return str(value or '')
    upper = str(value or '').upper()
    plain = re.sub(r'[ -]', '', upper)
    return plain[:3] + '-' + plain[3:] if re.fullmatch(r'[A-Z]{3}[0-9]{4}', plain) else upper


def link_code_value(value):
    code = str(value or '').strip().lower()
    if code and not re.fullmatch(r'(?:[0-9]{6}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})', code):
        raise ValueError('Código de vínculo: informe os 6 números recebidos do cliente.')
    return code


def money_value(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or not 0 <= amount <= Decimal('99999.99') or amount != amount.quantize(Decimal('.01')):
            raise ValueError()
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError('Valor inválido. Use de R$ 0,00 a R$ 99.999,99, com até duas casas decimais.') from None
    return float(amount)
