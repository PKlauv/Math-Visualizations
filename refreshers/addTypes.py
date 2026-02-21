def main():
    print(add_values(0,0))


def add_values(a, b):
    # this funcition takes two variables and adds them together
    a = input("Enter a value: ")
    b = input("Enter another value: ")
    # if boh are either int and/or float, then add them together
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            # make them into floats first 
            a = float(a)
            b = float(b)
            # check if both are integers, if so, we add them together as integers, otherwise we add them together as floats
            if a.is_integer() and b.is_integer():
                a = int(a)
                b = int(b)
            return a + b
    # if either of them is a string, then we concatenate them together
    else:
        a = str(a)
        b = str(b)
        return a + b



if __name__ == "__main__":
    main()